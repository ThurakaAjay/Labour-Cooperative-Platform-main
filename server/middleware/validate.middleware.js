const ApiError = require('../utils/apiError');

/**
 * Validation Middleware Runner
 * Accepts a validator function that takes req and returns { isValid, message, extra }
 */
const validate = (validatorFn) => (req, res, next) => {
  const result = validatorFn(req);
  if (!result.isValid) {
    return next(new ApiError(400, result.message, true, result.extra || {}));
  }
  next();
};

module.exports = validate;
