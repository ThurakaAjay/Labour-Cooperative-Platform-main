const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' }
});

// Razorpay calls this directly with no session — verified via HMAC signature instead.
router.post('/webhook', PaymentController.webhook);

router.get('/config', PaymentController.getConfig);

router.use(authenticate);
router.post('/create-order', paymentLimiter, PaymentController.createOrder);
router.post('/verify', paymentLimiter, PaymentController.verifyPayment);
router.get('/history', PaymentController.getHistory);

module.exports = router;
