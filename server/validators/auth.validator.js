/**
 * Auth Input Validators
 */

const validateRegister = (req) => {
  const { name, phone, password, role } = req.body || {};

  if (!name || !phone) {
    return { isValid: false, message: 'Name and phone number are required.' };
  }

  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password is required and must be at least 8 characters long.'
    };
  }

  if (role && !['customer', 'worker'].includes(role)) {
    return {
      isValid: false,
      message: role === 'admin'
        ? 'Administrative accounts cannot be created through registration.'
        : "Invalid role specified: must be 'customer' or 'worker'."
    };
  }

  return { isValid: true };
};

const validateLogin = (req) => {
  const { identifier, phone, email, password } = req.body || {};
  const loginId = (identifier || phone || email || '').trim();

  if (!loginId) {
    return { isValid: false, message: 'Phone number or email is required.' };
  }

  if (!password) {
    return { isValid: false, message: 'Password is required.' };
  }

  return { isValid: true };
};

const validateSendOtp = (req) => {
  const { phone } = req.body || {};
  if (!phone) {
    return { isValid: false, message: 'Phone number is required.' };
  }
  return { isValid: true };
};

const validateVerifyOtp = (req) => {
  const { phone, otp } = req.body || {};
  if (!phone || !otp) {
    return { isValid: false, message: 'Phone and OTP code are required.' };
  }
  return { isValid: true };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateSendOtp,
  validateVerifyOtp
};
