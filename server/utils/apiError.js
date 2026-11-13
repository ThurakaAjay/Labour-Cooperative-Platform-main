/**
 * Custom Operational API Error Class
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.extra = extra;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, extra = {}) {
    return new ApiError(400, message, true, extra);
  }

  static unauthorized(message = 'Unauthorized access', extra = {}) {
    return new ApiError(401, message, true, extra);
  }

  static forbidden(message = 'Forbidden access', extra = {}) {
    return new ApiError(403, message, true, extra);
  }

  static notFound(message = 'Resource not found', extra = {}) {
    return new ApiError(404, message, true, extra);
  }

  static conflict(message, extra = {}) {
    return new ApiError(409, message, true, extra);
  }

  static internal(message = 'Internal server error', extra = {}) {
    return new ApiError(500, message, false, extra);
  }
}

module.exports = ApiError;
