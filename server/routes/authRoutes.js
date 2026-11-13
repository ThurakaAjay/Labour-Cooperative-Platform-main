const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  validateRegister,
  validateLogin,
  validateSendOtp,
  validateVerifyOtp
} = require('../validators/auth.validator');

// 1. Register new Customer, Worker, or Admin
router.post('/register', validate(validateRegister), AuthController.register);

// 2. Log in with phone or email + password (bcrypt verified)
router.post('/login', validate(validateLogin), AuthController.login);

// 3. Generate & send secure OTP with TTL
router.post('/send-otp', validate(validateSendOtp), AuthController.sendOtp);

// 4. Verify OTP and issue JWT session
router.post('/verify-otp', validate(validateVerifyOtp), AuthController.verifyOtp);

// 5. Fetch authenticated user profile
router.get(['/me', '/profile'], authenticate, AuthController.getProfile);

// 6. Update user profile
router.put('/profile', authenticate, AuthController.updateProfile);

module.exports = router;
