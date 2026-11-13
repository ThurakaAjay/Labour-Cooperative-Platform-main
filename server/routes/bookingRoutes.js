const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const BookingController = require('../controllers/booking.controller');
const validate = require('../middleware/validate.middleware');
const { validateCreateBooking, validateProposeReschedule, validateRespondToReschedule } = require('../validators/booking.validator');
const { authenticate } = require('../middleware/auth.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Blunt brute-forcing a 4-digit arrival PIN beyond the per-booking attempt
// counter already enforced in BookingService.verifyArrivalPin.
const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many PIN verification attempts. Please try again later.' }
});

// Enforce authentication on all booking operations
router.use(authenticate);

// 1. Fetch bookings with role-based scoping
router.get('/', BookingController.getBookings);

// 2. Fetch single booking with object-level authorization
router.get('/:id', BookingController.getBookingById);

// 3. Create new customer booking
router.post('/', validate(validateCreateBooking), BookingController.createBooking);

// 4. Update booking lifecycle / tracking / status
router.put('/:id/status', BookingController.updateBookingStatus);
router.put('/:id', BookingController.updateBookingStatus);

// 5. Worker accept (via status) / reject / reschedule workflow
router.put('/:id/reject', BookingController.rejectBooking);
router.put('/:id/reschedule', validate(validateProposeReschedule), BookingController.proposeReschedule);
router.put('/:id/reschedule/respond', validate(validateRespondToReschedule), BookingController.respondToReschedule);

// 6. Arrival PIN verification
router.post('/:id/verify-pin', pinVerifyLimiter, BookingController.verifyPin);

// 7. Photo upload (issue evidence / proof of completion) via Cloudinary
router.post('/:id/photos', handleUpload, BookingController.uploadPhoto);

// 8. Customer-initiated cancellation (with required reason) / admin-or-owner delete
router.patch('/:id/cancel', BookingController.cancelBooking);
router.delete('/:id', BookingController.deleteBooking);

module.exports = router;
