const BookingService = require('../services/booking.service');
const Worker = require('../models/Worker');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isCloudinaryConfigured } = require('../config/cloudinary');
const { streamUploadToCloudinary } = require('../utils/cloudinaryUpload');

// The arrival PIN only serves its purpose (proving the worker is physically
// on-site, told the code by the customer) if the worker's own app never
// shows it to them. Strip it from any response a worker can see — they only
// ever interact with it through POST /bookings/:id/verify-pin.
const redactPinForRole = (bookingDoc, user) => {
  const plain = typeof bookingDoc.toObject === 'function' ? bookingDoc.toObject() : bookingDoc;
  if (user.role === 'worker' && isSameId(plain.workerId, user.userId)) {
    const { arrivalPin, ...rest } = plain;
    return rest;
  }
  return plain;
};

// Defensive identity comparison: both sides are always Strings on this
// schema, but coercing explicitly guards against any future field that ends
// up holding a Mongo ObjectId (or a numeric ID) instead, which would
// otherwise fail `===` for a genuinely matching id.
const isSameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

// A booking a worker can act on: either already assigned to them, or still
// unclaimed and open to any worker (broadcast job requests).
const isAssignableWorker = (booking, user) =>
  user.role === 'worker' && (
    isSameId(booking.workerId, user.userId) ||
    !booking.workerId ||
    booking.workerId === 'unassigned'
  );

class BookingController {
  /**
   * GET /api/bookings
   */
  static getBookings = asyncHandler(async (req, res) => {
    const user = req.user;
    const query = { ...req.query };

    // Strict role scoping to prevent horizontal data leaks. customerName is
    // OR'd together with customerId/customerPhone inside BookingService, so a
    // client-supplied customerName must never survive here for a scoped role
    // — otherwise it would widen the match to other customers' bookings.
    if (user.role === 'customer') {
      delete query.customerName;
      query.customerId = user.userId;
      query.customerPhone = user.phone;
    } else if (user.role === 'worker') {
      delete query.customerId;
      delete query.customerPhone;
      delete query.customerName;
      query.workerId = user.userId;
    }

    const result = await BookingService.getBookings(query);
    return res.json({
      success: true,
      count: result.count,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      data: result.data.map((b) => redactPinForRole(b, user))
    });
  });

  /**
   * GET /api/bookings/:id
   */
  static getBookingById = asyncHandler(async (req, res) => {
    const booking = await BookingService.getBookingById(req.params.id);
    const user = req.user;

    // Enforce Object-Level Authorization (IDOR protection)
    const isOwner = isSameId(booking.customerId, user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    const isAssignedWorker = isSameId(booking.workerId, user.userId);
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAssignedWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to view this booking.'
      });
    }

    return ApiResponse.success(res, redactPinForRole(booking, user));
  });

  /**
   * POST /api/bookings
   */
  static createBooking = asyncHandler(async (req, res) => {
    const user = req.user;

    // Bind booking directly to authenticated customer session to prevent impersonation
    const bookingData = {
      ...req.body,
      customerId: user.userId,
      customerName: user.name || req.body.customerName,
      customerPhone: user.phone || req.body.customerPhone
    };

    const booking = await BookingService.createBooking(bookingData);
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully in MongoDB',
      data: booking
    });
  });

  /**
   * PUT /api/bookings/:id/status or PUT /api/bookings/:id
   */
  static updateBookingStatus = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    const isOwner = isSameId(booking.customerId, user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    const isAssignedWorker = isAssignableWorker(booking, user);
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAssignedWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to modify this booking.'
      });
    }

    const updatePayload = { ...req.body };
    // Strictly gate forceAdminOverride: only authenticated administrators can force state transitions
    updatePayload.forceAdminOverride = isAdmin && Boolean(req.body.forceAdminOverride);

    if (user.role === 'worker' && (!booking.workerId || booking.workerId === 'unassigned')) {
      // Job-readiness gate: a worker can't pick up a fresh (previously
      // unassigned) job until their profile is fully filled in AND their
      // documents are admin-verified. This is the one write path that
      // actually assigns a new job to a worker, so it's the authoritative
      // enforcement point — the customer-facing directory (WorkerService.getWorkers)
      // applies the same two conditions as a read-path filter.
      const actingWorker = await Worker.findOne({ workerId: user.userId });
      if (!actingWorker || actingWorker.verificationStatus !== 'verified' || !actingWorker.isProfileComplete) {
        return res.status(403).json({
          success: false,
          message: 'Complete your profile and verification before accepting jobs.'
        });
      }
      updatePayload.workerId = user.userId;
      updatePayload.workerName = user.name;
    }

    // Role-specific transition permissions
    const { status } = req.body;
    if (status && !isAdmin) {
      if (user.role === 'customer') {
        if (!['cancelled', 'paid', 'rated'].includes(status)) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: Customers cannot transition booking status to '${status}'.`
          });
        }
        if (status === 'cancelled' && !['pending'].includes(booking.status)) {
          return res.status(400).json({
            success: false,
            message: `Cannot cancel booking that is already '${booking.status}'.`
          });
        }
      } else if (user.role === 'worker') {
        const workerAllowed = ['accepted', 'on_the_way', 'arrived', 'working', 'in_progress', 'completed'];
        if (!workerAllowed.includes(status)) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: Workers cannot transition booking status to '${status}'.`
          });
        }
      }
    }

    const updated = await BookingService.updateBookingStatus(req.params.id, updatePayload);
    return ApiResponse.success(res, redactPinForRole(updated, user), `Booking status updated to ${updatePayload.status || 'updated'}`);
  });

  /**
   * POST /api/bookings/:id/verify-pin — worker validates the customer's
   * arrival PIN before being allowed to start on-site work.
   */
  static verifyPin = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    if (user.role !== 'worker' || !isSameId(booking.workerId, user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the assigned worker can verify the arrival PIN.'
      });
    }

    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required.' });
    }

    const { booking: updated, alreadyVerified } = await BookingService.verifyArrivalPin(req.params.id, pin);
    return ApiResponse.success(res, redactPinForRole(updated, user), alreadyVerified ? 'PIN was already verified.' : 'Arrival PIN verified successfully.');
  });

  /**
   * PUT /api/bookings/:id/reject — worker declines a pending job request.
   */
  static rejectBooking = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    if (!isAssignableWorker(booking, user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the assigned worker can reject this job request.'
      });
    }

    const updated = await BookingService.rejectBooking(req.params.id, req.body.reason);
    return ApiResponse.success(res, redactPinForRole(updated, user), 'Booking rejected.');
  });

  /**
   * PUT /api/bookings/:id/reschedule — worker proposes an alternative
   * availability window (e.g. "free 6 Sep, 12-5 PM") for the customer to
   * pick a slot within.
   */
  static proposeReschedule = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    // Bug fix: this previously required an exact match on booking.workerId,
    // so a worker viewing a still-unclaimed ('unassigned') job request would
    // get a 403 here even though the identical check on Accept/Reject
    // already allowed any worker to act on an unassigned booking.
    if (!isAssignableWorker(booking, user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the assigned worker can propose a reschedule.'
      });
    }

    const updated = await BookingService.proposeReschedule(req.params.id, {
      windowStart: req.body.windowStart,
      windowEnd: req.body.windowEnd,
      reason: req.body.reason,
      workerId: user.userId
    });
    return ApiResponse.success(res, redactPinForRole(updated, user), 'Reschedule proposed to customer.');
  });

  /**
   * PUT /api/bookings/:id/reschedule/respond — customer picks a specific
   * slot within the worker's proposed window (accept) or cancels the
   * booking outright.
   */
  static respondToReschedule = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    const isOwner = isSameId(booking.customerId, user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));

    if (user.role !== 'customer' || !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the booking customer can respond to a reschedule proposal.'
      });
    }

    const { action, selectedStart } = req.body;
    if (!['accept', 'cancel'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'cancel'." });
    }
    if (action === 'accept' && !selectedStart) {
      return res.status(400).json({ success: false, message: 'selectedStart is required to accept a proposed slot.' });
    }

    const updated = await BookingService.respondToReschedule(req.params.id, action, selectedStart);
    return ApiResponse.success(res, updated, action === 'accept' ? 'New time confirmed.' : 'Booking cancelled.');
  });

  /**
   * POST /api/bookings/:id/photos — attach a customer- or worker-uploaded
   * photo (multipart field "photo") to the booking via Cloudinary.
   */
  static uploadPhoto = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    const isOwner = isSameId(booking.customerId, user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    const isAssignedWorker = isSameId(booking.workerId, user.userId);

    if (!isOwner && !isAssignedWorker && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to attach photos to this booking.'
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Photo uploads are not available: Cloudinary credentials are not configured on the server.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file was provided (expected multipart field "photo").' });
    }

    const result = await streamUploadToCloudinary(req.file.buffer, `workhive/bookings/${booking.bookingId}`);
    const uploadedBy = isAssignedWorker && !isOwner ? 'worker' : 'customer';

    const updated = await BookingService.addPhoto(req.params.id, {
      url: result.secure_url,
      publicId: result.public_id,
      uploadedBy
    });

    return ApiResponse.success(res, redactPinForRole(updated, user), 'Photo uploaded and attached to booking.');
  });

  /**
   * PATCH /api/bookings/:id/cancel — customer-initiated cancellation with a
   * required reason, available any time before the job completes.
   */
  static cancelBooking = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the customer who created this booking can cancel it.'
      });
    }

    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'A cancellation reason is required.' });
    }

    const updated = await BookingService.cancelBookingByCustomer(req.params.id, {
      reason: String(reason).trim(),
      userId: user.userId,
      phone: user.phone
    });

    return ApiResponse.success(res, redactPinForRole(updated, user), 'Booking cancelled successfully.');
  });

  /**
   * DELETE /api/bookings/:id
   */
  static deleteBooking = asyncHandler(async (req, res) => {
    const user = req.user;
    const booking = await BookingService.getBookingById(req.params.id);

    const isOwner = isSameId(booking.customerId, user.userId) ||
                    (booking.customerPhone && user.phone && booking.customerPhone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
    const isAdmin = user.role === 'admin';

    if (!isAdmin && (!isOwner || booking.status !== 'pending')) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators or the booking customer (while pending) can remove a booking.'
      });
    }

    const deleted = await BookingService.deleteBooking(req.params.id);
    return ApiResponse.success(res, deleted, 'Booking removed successfully');
  });
}

module.exports = BookingController;
