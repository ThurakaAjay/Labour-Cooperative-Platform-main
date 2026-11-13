const crypto = require('crypto');
const Booking = require('../models/Booking');
const AdminMetric = require('../models/AdminMetric');
const Worker = require('../models/Worker');
const Service = require('../models/Service');
const ApiError = require('../utils/apiError');
const escapeRegex = require('../utils/escapeRegex');
const { geocodeAddress } = require('../utils/geocode');
const { PaymentService } = require('./payment.service');

// Resolve and persist coordinates in the background so booking creation
// never blocks on a third-party geocoding round trip; failures are swallowed
// since location is best-effort enrichment, not required for the booking to work.
const geocodeBookingInBackground = (bookingId, address) => {
  geocodeAddress(address)
    .then((resolved) => {
      if (!resolved) return;
      return Booking.findOneAndUpdate(
        { bookingId },
        {
          location: {
            lat: resolved.lat,
            lng: resolved.lng,
            formattedAddress: resolved.formattedAddress,
            geocodedAt: new Date()
          }
        }
      );
    })
    .catch((err) => console.warn('[Booking] Background geocode failed:', err.message));
};

class BookingService {
  /**
   * Get bookings with optional status, worker, or customer query
   */
  static async getBookings({ status, workerId, customerPhone, customerId, customerName, page = 1, limit = 50 }) {
    const query = {};

    if (status && status !== 'All') {
      if (status === 'Emergency') {
        query.isEmergency = true;
      } else {
        query.status = status.toLowerCase().replace(/\s+/g, '_');
      }
    }

    if (workerId) {
      query.workerId = workerId;
    }

    if (customerPhone || customerId || customerName) {
      const orClauses = [];
      if (customerId) {
        orClauses.push({ customerId });
      }
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
        orClauses.push({ customerPhone });
        if (cleanPhone.length >= 7) {
          orClauses.push({ customerPhone: new RegExp(escapeRegex(cleanPhone), 'i') });
        }
      }
      if (customerName && !['Member', 'Customer', 'Customer Member'].includes(customerName)) {
        orClauses.push({ customerName: new RegExp(escapeRegex(customerName), 'i') });
      }
      if (orClauses.length > 0) {
        query.$or = orClauses;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    return {
      count: bookings.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: bookings
    };
  }

  /**
   * Get single booking by ID
   */
  static async getBookingById(id) {
    let booking = await Booking.findOne({ bookingId: id });
    if (!booking && id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }

    if (!booking) {
      throw new ApiError(404, `Booking with ID '${id}' not found`);
    }

    return booking;
  }

  /**
   * Create new booking
   */
  static async createBooking(bookingData) {
    const {
      customerName,
      customerId,
      customerPhone,
      customerAddress,
      serviceCategory,
      serviceDetails,
      workerId,
      workerName,
      amount,
      isEmergency = false
    } = bookingData;

    const bookingId = bookingData.bookingId || 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Server-side price validation against Service catalog
    let finalAmount = Number(amount) || 450;
    if (serviceCategory) {
      const escapedCategory = escapeRegex(serviceCategory);
      const catalog = await Service.findOne({
        $or: [
          { category: new RegExp(`^${escapedCategory}$`, 'i') },
          { title: new RegExp(escapedCategory, 'i') }
        ]
      });
      if (catalog && catalog.rateNumber && finalAmount < catalog.rateNumber) {
        throw new ApiError(400, `Booking amount (₹${finalAmount}) cannot be less than the catalog base rate of ₹${catalog.rateNumber} for ${serviceCategory}.`);
      }
    }

    // Cryptographically secure 4-digit arrival PIN
    const arrivalPin = String(crypto.randomInt(1000, 9999));

    const newBooking = new Booking({
      bookingId,
      customerName,
      customerId: customerId || '',
      customerPhone,
      customerAddress,
      serviceCategory,
      serviceDetails: serviceDetails || `${serviceCategory} service request`,
      workerId: workerId || 'unassigned',
      workerName: workerName || 'Cooperative Worker',
      amount: finalAmount,
      status: 'pending',
      isEmergency,
      arrivalPin
    });

    const saved = await newBooking.save();

    // Increment today's jobs and pending jobs in Admin metrics
    await AdminMetric.findOneAndUpdate(
      { metricKey: 'primary_node_metrics' },
      { $inc: { todayJobs: 1, pendingJobs: 1 } },
      { upsert: true }
    );

    geocodeBookingInBackground(saved.bookingId, saved.customerAddress);

    return saved;
  }

  /**
   * Update booking lifecycle / tracking / rating
   */
  static async updateBookingStatus(id, updateData) {
    const { status, isLocationSharing, rating, feedback, paymentMethod, workerId, workerName } = updateData;

    // Check existing status to ensure state machine idempotency
    let existing = await Booking.findOne({ bookingId: id });
    let matchKey = { bookingId: id };
    if (!existing && id.match(/^[0-9a-fA-F]{24}$/)) {
      existing = await Booking.findById(id);
      matchKey = { _id: id };
    }
    if (!existing) {
      throw new ApiError(404, `Booking with ID '${id}' not found`);
    }

    const previousStatus = existing.status;

    // Strict booking lifecycle state machine validation
    if (status && status !== previousStatus) {
      const VALID_STATUS_TRANSITIONS = {
        pending: ['accepted', 'rejected', 'on_the_way', 'cancelled'],
        accepted: ['on_the_way', 'arrived', 'cancelled'],
        on_the_way: ['arrived', 'working', 'in_progress', 'cancelled'],
        arrived: ['working', 'in_progress', 'completed', 'cancelled'],
        working: ['completed', 'cancelled'],
        in_progress: ['completed', 'cancelled'],
        completed: ['paid', 'rated'],
        paid: ['rated'],
        rejected: [],
        rated: [],
        cancelled: []
      };

      const allowedNext = VALID_STATUS_TRANSITIONS[previousStatus] || [];
      if (!updateData.forceAdminOverride && !allowedNext.includes(status)) {
        throw new ApiError(
          400,
          `Invalid state transition: Cannot transition booking from '${previousStatus}' to '${status}'. Allowed: ${allowedNext.length ? allowedNext.join(', ') : 'none (terminal state)'}`
        );
      }

      // The customer's arrival PIN exists specifically so a worker can't
      // start billable work without being physically present to read it off
      // the customer. Require it to have been verified via verifyArrivalPin()
      // before allowing the on-site work states.
      if (!updateData.forceAdminOverride && ['working', 'in_progress'].includes(status) && !existing.pinVerifiedAt) {
        throw new ApiError(400, 'Arrival PIN must be verified with the customer before starting work.');
      }
    }

    const updateFields = {};
    if (status) updateFields.status = status;
    if (isLocationSharing !== undefined) updateFields.isLocationSharing = isLocationSharing;
    if (rating !== undefined) updateFields.rating = rating;
    if (feedback !== undefined) updateFields.feedback = feedback;
    if (paymentMethod) updateFields.paymentMethod = paymentMethod;
    // Set when a worker self-assigns to a previously unassigned booking (see
    // booking.controller.js#updateBookingStatus) — without this the
    // conditional-match concurrency guard below is a no-op, since workerId
    // would silently stay 'unassigned' forever regardless of who "accepted".
    if (workerId) updateFields.workerId = workerId;
    if (workerName) updateFields.workerName = workerName;

    // Condition the write on the status we just read so two concurrent
    // requests (e.g. two workers accepting the same unassigned booking)
    // can't both succeed — the second one's match fails because the first
    // already changed `status`, and it gets a 409 instead of silently
    // overwriting the first worker's assignment.
    const conditionalMatch = { ...matchKey };
    if (!updateData.forceAdminOverride) {
      conditionalMatch.status = previousStatus;
    }

    const booking = await Booking.findOneAndUpdate(conditionalMatch, updateFields, { returnDocument: 'after' });
    if (!booking) {
      throw new ApiError(409, `Booking '${id}' was just updated by another request. Please retry.`);
    }

    // Only increment financial metrics once when transitioning to completed
    if (status === 'completed' && previousStatus !== 'completed' && previousStatus !== 'paid') {
      const gross = booking.amount;
      const workerTakeHome = Math.round(gross * 0.95);
      const welfareFund = gross - workerTakeHome;

      await Promise.all([
        AdminMetric.findOneAndUpdate(
          { metricKey: 'primary_node_metrics' },
          {
            $inc: {
              completedJobs: 1,
              pendingJobs: -1,
              totalEarningsDistributed: workerTakeHome,
              welfareFundBalance: welfareFund
            }
          }
        ),
        Worker.findOneAndUpdate(
          { workerId: booking.workerId },
          { $inc: { completedJobs: 1 } }
        )
      ]);
    }

    return booking;
  }

  /**
   * Resolve a booking by its bookingId or Mongo _id, returning both the
   * document and the query fragment that uniquely matches it (used by
   * callers that need to issue a follow-up conditional update).
   */
  static async _resolveBooking(id) {
    let booking = await Booking.findOne({ bookingId: id });
    let matchKey = { bookingId: id };
    if (!booking && id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
      matchKey = { _id: id };
    }
    if (!booking) {
      throw new ApiError(404, `Booking with ID '${id}' not found`);
    }
    return { booking, matchKey };
  }

  /**
   * Worker validates the customer's arrival PIN before being allowed to
   * start on-site work. Rate-limited per booking to blunt brute-forcing a
   * 4-digit code, and uses a timing-safe comparison to avoid leaking the
   * correct PIN through response-time side channels.
   */
  static async verifyArrivalPin(id, submittedPin) {
    const { booking, matchKey } = await BookingService._resolveBooking(id);

    if (booking.pinVerifiedAt) {
      return { booking, alreadyVerified: true };
    }

    if (booking.pinAttempts >= 5) {
      throw new ApiError(429, 'Too many incorrect PIN attempts for this booking. Please contact the cooperative office.');
    }

    const expected = Buffer.from(String(booking.arrivalPin));
    const submitted = Buffer.from(String(submittedPin || ''));
    const isMatch = expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);

    if (!isMatch) {
      await Booking.findOneAndUpdate(matchKey, { $inc: { pinAttempts: 1 } });
      throw new ApiError(400, 'Incorrect arrival PIN. Please confirm the code with the customer.');
    }

    const updated = await Booking.findOneAndUpdate(
      matchKey,
      { pinVerifiedAt: new Date(), pinAttempts: 0 },
      { returnDocument: 'after' }
    );

    return { booking: updated, alreadyVerified: false };
  }

  // The job's assumed duration — a proposed availability window must be able
  // to fit at least one slot of this length for the customer to pick from.
  static RESCHEDULE_SLOT_DURATION_MS = 2 * 60 * 60 * 1000;

  /**
   * Worker proposes an alternative availability window for a job that hasn't
   * started yet (e.g. "free 6 Sep, 12:00 PM - 5:00 PM"), for the customer to
   * pick a specific slot within.
   */
  static async proposeReschedule(id, { windowStart, windowEnd, reason, workerId }) {
    const { booking, matchKey } = await BookingService._resolveBooking(id);

    if (!['pending', 'accepted'].includes(booking.status)) {
      throw new ApiError(400, `Cannot propose a reschedule for a booking that is already '${booking.status}'.`);
    }

    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ApiError(400, 'A valid availability window (windowStart and windowEnd) is required.');
    }
    if (start.getTime() <= Date.now()) {
      throw new ApiError(400, 'The proposed availability window must start in the future.');
    }
    if (end.getTime() - start.getTime() < BookingService.RESCHEDULE_SLOT_DURATION_MS) {
      throw new ApiError(400, `The availability window must be at least ${BookingService.RESCHEDULE_SLOT_DURATION_MS / 3600000} hours long so the customer can pick a slot.`);
    }

    const updated = await Booking.findOneAndUpdate(
      matchKey,
      {
        reschedule: {
          status: 'pending',
          windowStart: start,
          windowEnd: end,
          reason: reason || '',
          proposedBy: workerId || booking.workerId,
          selectedStart: null,
          selectedEnd: null,
          respondedAt: null
        }
      },
      { returnDocument: 'after' }
    );

    return updated;
  }

  /**
   * Customer accepts a specific slot within the worker's proposed window
   * (confirming the booking for that slot) or cancels the booking outright.
   */
  static async respondToReschedule(id, action, selectedStart) {
    const { booking, matchKey } = await BookingService._resolveBooking(id);

    if (booking.reschedule?.status !== 'pending') {
      throw new ApiError(400, 'There is no pending reschedule request on this booking.');
    }

    if (action === 'accept') {
      const { windowStart, windowEnd } = booking.reschedule;
      const slotStart = new Date(selectedStart);
      if (Number.isNaN(slotStart.getTime())) {
        throw new ApiError(400, 'A valid selectedStart time (within the proposed window) is required to accept.');
      }
      const slotEnd = new Date(slotStart.getTime() + BookingService.RESCHEDULE_SLOT_DURATION_MS);
      if (slotStart.getTime() < windowStart.getTime() || slotEnd.getTime() > windowEnd.getTime()) {
        throw new ApiError(400, 'The selected slot must fall entirely within the worker\'s proposed availability window.');
      }

      const updated = await Booking.findOneAndUpdate(
        matchKey,
        {
          status: 'accepted',
          scheduledFor: slotStart,
          'reschedule.status': 'accepted',
          'reschedule.selectedStart': slotStart,
          'reschedule.selectedEnd': slotEnd,
          'reschedule.respondedAt': new Date()
        },
        { returnDocument: 'after' }
      );
      return updated;
    }

    if (action === 'cancel') {
      const updated = await Booking.findOneAndUpdate(
        matchKey,
        {
          status: 'cancelled',
          'reschedule.status': 'rejected',
          'reschedule.respondedAt': new Date()
        },
        { returnDocument: 'after' }
      );
      return updated;
    }

    throw new ApiError(400, `Unknown reschedule response action '${action}'. Expected 'accept' or 'cancel'.`);
  }

  /**
   * Worker declines a pending job request.
   */
  static async rejectBooking(id, reason) {
    const { matchKey } = await BookingService._resolveBooking(id);

    const updated = await Booking.findOneAndUpdate(
      { ...matchKey, status: 'pending' },
      { status: 'rejected', rejectionReason: reason || 'Declined by worker' },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new ApiError(409, `Booking '${id}' is no longer pending and cannot be rejected.`);
    }

    await AdminMetric.findOneAndUpdate(
      { metricKey: 'primary_node_metrics' },
      { $inc: { pendingJobs: -1 } }
    );

    return updated;
  }

  // Terminal/near-terminal states from which a customer can no longer back
  // out — mirrors the 'cancelled' entries in updateBookingStatus's state
  // machine, kept as an explicit list here so cancelBookingByCustomer can
  // give a clear reason rather than a generic transition error.
  static CANCELLABLE_STATUSES = ['pending', 'accepted', 'on_the_way', 'arrived', 'working', 'in_progress'];

  /**
   * Customer-initiated cancellation, available any time before the job is
   * completed (emergency, no longer needed, unresponsive worker, etc.) —
   * unlike the plain status-update path, this records why the booking was
   * cancelled and triggers the worker-slot release / refund side effects.
   */
  static async cancelBookingByCustomer(id, { reason, userId, phone }) {
    const { booking, matchKey } = await BookingService._resolveBooking(id);

    const isOwner = (booking.customerId && userId && booking.customerId === userId) ||
      (booking.customerPhone && phone && booking.customerPhone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!isOwner) {
      throw new ApiError(403, 'Forbidden: Only the customer who created this booking can cancel it.');
    }

    if (!BookingService.CANCELLABLE_STATUSES.includes(booking.status)) {
      throw new ApiError(400, `Cannot cancel booking that is already '${booking.status}'.`);
    }

    const wasPending = booking.status === 'pending';
    const refund = await PaymentService.refundForCancelledBooking(booking);

    const updated = await Booking.findOneAndUpdate(
      { ...matchKey, status: booking.status },
      {
        status: 'cancelled',
        cancellationDetails: {
          reason: reason || 'No reason provided',
          cancelledBy: 'customer',
          cancelledAt: new Date()
        },
        ...(refund.refundStatus !== 'none' && {
          'payment.refundStatus': refund.refundStatus,
          'payment.refundedAt': refund.refundedAt || null
        })
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new ApiError(409, `Booking '${id}' was just updated by another request. Please retry.`);
    }

    // Releases the worker's slot for this job: WorkerJobs/JobManagement
    // derive their "active jobs" list by filtering out terminal statuses
    // (including 'cancelled'), so this status change alone is what makes the
    // worker immediately available for new dispatch — no separate calendar
    // record to clear.
    if (wasPending) {
      await AdminMetric.findOneAndUpdate(
        { metricKey: 'primary_node_metrics' },
        { $inc: { pendingJobs: -1 } }
      );
    }

    return updated;
  }

  /**
   * Attach an already-uploaded Cloudinary photo (issue evidence or proof of
   * completion) to a booking record.
   */
  static async addPhoto(id, { url, publicId, uploadedBy }) {
    const { matchKey } = await BookingService._resolveBooking(id);

    const updated = await Booking.findOneAndUpdate(
      matchKey,
      { $push: { photos: { url, publicId: publicId || '', uploadedBy: uploadedBy || 'customer', uploadedAt: new Date() } } },
      { returnDocument: 'after' }
    );

    return updated;
  }

  /**
   * Delete or cancel a booking
   */
  static async deleteBooking(id) {
    let booking = await Booking.findOneAndDelete({ bookingId: id });
    if (!booking && id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findByIdAndDelete(id);
    }

    if (!booking) {
      throw new ApiError(404, `Booking with ID '${id}' not found`);
    }

    return booking;
  }
}

module.exports = BookingService;
