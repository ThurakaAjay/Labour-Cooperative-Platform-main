const crypto = require('crypto');
const Razorpay = require('razorpay');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const AdminMetric = require('../models/AdminMetric');
const ApiError = require('../utils/apiError');

const isRazorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpayClient = isRazorpayConfigured
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

class PaymentService {
  /**
   * Create a Razorpay order for a completed booking awaiting settlement.
   */
  static async createOrder(bookingId, user) {
    if (!isRazorpayConfigured) {
      throw new ApiError(503, 'Payments are not available: Razorpay credentials are not configured on the server.');
    }

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      throw new ApiError(404, `Booking with ID '${bookingId}' not found`);
    }

    const isOwner = (booking.customerId && booking.customerId === user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    if (!isOwner && user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden: You are not authorized to pay for this booking.');
    }

    if (!['completed'].includes(booking.status) || booking.payment?.status === 'paid') {
      throw new ApiError(400, `Booking '${bookingId}' is not awaiting payment (status: ${booking.status}, payment: ${booking.payment?.status || 'unpaid'}).`);
    }

    const amountPaise = Math.round(booking.amount * 100);

    const order = await razorpayClient.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `receipt_${booking.bookingId}`,
      notes: { bookingId: booking.bookingId, customerId: booking.customerId, workerId: booking.workerId }
    });

    const transactionId = 'TXN-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    await Transaction.create({
      transactionId,
      bookingId: booking.bookingId,
      customerId: booking.customerId,
      workerId: booking.workerId,
      amount: booking.amount,
      method: 'razorpay',
      status: 'created',
      razorpayOrderId: order.id
    });

    await Booking.findOneAndUpdate(
      { bookingId: booking.bookingId },
      { 'payment.status': 'created', 'payment.orderId': order.id }
    );

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      transactionId
    };
  }

  /**
   * Verify the HMAC signature Razorpay Checkout returns after a successful
   * payment, then mark the booking and transaction as paid. Idempotent: a
   * repeated call with the same order/payment IDs is a no-op success.
   */
  static async verifyPayment({ bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature }, user) {
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      throw new ApiError(404, `Booking with ID '${bookingId}' not found`);
    }

    const isOwner = (booking.customerId && booking.customerId === user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    if (!isOwner && user.role !== 'admin') {
      throw new ApiError(403, 'Forbidden: You are not authorized to confirm payment for this booking.');
    }

    if (booking.payment?.status === 'paid') {
      return booking; // Already settled — treat as idempotent success.
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const providedBuf = Buffer.from(razorpaySignature || '');
    const expectedBuf = Buffer.from(expectedSignature);
    const isValid = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

    if (!isValid) {
      await Transaction.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'failed', failureReason: 'Signature verification failed' }
      );
      throw new ApiError(400, 'Payment signature verification failed.');
    }

    return PaymentService._settlePayment({ bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature });
  }

  /**
   * Shared settlement logic used by both the client-side verify endpoint and
   * the server-to-server Razorpay webhook, so a payment is credited exactly
   * once regardless of which path confirms it first.
   */
  static async _settlePayment({ bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return null;
    if (booking.payment?.status === 'paid') return booking; // Idempotent

    const workerShare = Math.round(booking.amount * 0.95);
    const welfareShare = booking.amount - workerShare;

    const updatedTxn = await Transaction.findOneAndUpdate(
      { razorpayOrderId, status: { $ne: 'paid' } },
      {
        status: 'paid',
        razorpayPaymentId,
        razorpaySignature: razorpaySignature || '',
        workerShare,
        welfareShare
      },
      { returnDocument: 'after' }
    );

    // Another concurrent request already settled this exact order — treat as success.
    if (!updatedTxn) {
      return Booking.findOne({ bookingId });
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { bookingId, 'payment.status': { $ne: 'paid' } },
      {
        status: 'paid',
        'payment.status': 'paid',
        'payment.orderId': razorpayOrderId,
        'payment.paymentId': razorpayPaymentId,
        'payment.amountPaid': booking.amount,
        'payment.paidAt': new Date()
      },
      { returnDocument: 'after' }
    );

    return updatedBooking || booking;
  }

  /**
   * Handle Razorpay's server-to-server webhook (payment.captured /
   * payment.failed). The caller is responsible for verifying the raw-body
   * HMAC signature before invoking this.
   */
  static async handleWebhookEvent(event) {
    const payload = event.payload?.payment?.entity;
    if (!payload) return;

    const orderId = payload.order_id;
    const paymentId = payload.id;

    if (event.event === 'payment.captured') {
      const txn = await Transaction.findOne({ razorpayOrderId: orderId });
      if (txn) {
        await PaymentService._settlePayment({
          bookingId: txn.bookingId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: ''
        });
      }
    } else if (event.event === 'payment.failed') {
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: orderId, status: { $ne: 'paid' } },
        { status: 'failed', failureReason: payload.error_description || 'Payment failed at gateway' }
      );
    }
  }

  /**
   * Refund hook invoked when a customer cancels a booking that was already
   * paid for. Attempts a real Razorpay refund when the gateway is
   * configured and a captured payment exists; otherwise (or on gateway
   * failure) leaves the booking in 'pending' refund status for manual
   * settlement by the cooperative office rather than silently dropping it.
   */
  static async refundForCancelledBooking(booking) {
    if (booking.payment?.status !== 'paid') {
      return { refundStatus: 'none' };
    }

    const txn = await Transaction.findOne({ bookingId: booking.bookingId, status: 'paid' }).sort({ createdAt: -1 });
    const paymentId = txn?.razorpayPaymentId || booking.payment?.paymentId;

    if (isRazorpayConfigured && paymentId) {
      try {
        await razorpayClient.payments.refund(paymentId, {
          amount: Math.round((txn?.amount || booking.amount) * 100)
        });
        if (txn) {
          await Transaction.findOneAndUpdate({ transactionId: txn.transactionId }, { status: 'refunded' });
        }
        return { refundStatus: 'refunded', refundedAt: new Date() };
      } catch (err) {
        console.warn(`[Payment] Razorpay refund failed for booking ${booking.bookingId}:`, err.message);
        return { refundStatus: 'pending' };
      }
    }

    // No gateway configured (or no captured payment reference) — flag for
    // manual refund rather than claiming one was issued.
    return { refundStatus: 'pending' };
  }

  static async getTransactionHistory({ customerId, workerId, page = 1, limit = 50 }) {
    const query = {};
    if (customerId) query.customerId = customerId;
    if (workerId) query.workerId = workerId;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
    ]);

    return { total, page: pageNum, totalPages: Math.ceil(total / limitNum), data };
  }
}

module.exports = { PaymentService, isRazorpayConfigured };
