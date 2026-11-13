const crypto = require('crypto');
const { PaymentService, isRazorpayConfigured } = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class PaymentController {
  /**
   * POST /api/payments/create-order
   */
  static createOrder = asyncHandler(async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required.' });
    }
    const order = await PaymentService.createOrder(bookingId, req.user);
    return ApiResponse.success(res, order, 'Razorpay order created.');
  });

  /**
   * POST /api/payments/verify
   */
  static verifyPayment = asyncHandler(async (req, res) => {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'bookingId, razorpayOrderId, razorpayPaymentId and razorpaySignature are all required.' });
    }
    const booking = await PaymentService.verifyPayment(
      { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature },
      req.user
    );
    return ApiResponse.success(res, booking, 'Payment verified and booking marked as paid.');
  });

  /**
   * GET /api/payments/history
   */
  static getHistory = asyncHandler(async (req, res) => {
    const user = req.user;
    const query = { ...req.query };
    if (user.role === 'customer') {
      query.customerId = user.userId;
      delete query.workerId;
    } else if (user.role === 'worker') {
      query.workerId = user.userId;
      delete query.customerId;
    }
    const result = await PaymentService.getTransactionHistory(query);
    return res.json({ success: true, ...result });
  });

  /**
   * POST /api/payments/webhook — Razorpay server-to-server callback.
   * Unauthenticated (Razorpay can't hold a session JWT); trust is instead
   * established purely via the HMAC signature over the raw request body.
   */
  static webhook = asyncHandler(async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Fail closed: without a configured secret we cannot verify authenticity.
      return res.status(503).json({ success: false, message: 'Webhook not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!signature || !rawBody) {
      return res.status(400).json({ success: false, message: 'Missing signature or raw body.' });
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    const isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    await PaymentService.handleWebhookEvent(req.body);
    return res.json({ success: true });
  });

  static getConfig = asyncHandler(async (req, res) => {
    return res.json({ success: true, data: { configured: isRazorpayConfigured } });
  });
}

module.exports = PaymentController;
