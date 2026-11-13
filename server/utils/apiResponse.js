/**
 * Standardized API Response Helper
 */
class ApiResponse {
  /**
   * Send successful JSON response
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const payload = { success: true, message };
    if (data !== null && data !== undefined) {
      // If data has count and data property directly or is an array
      if (typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
        Object.assign(payload, data);
      } else {
        payload.data = data;
      }
    }
    return res.status(statusCode).json(payload);
  }

  /**
   * Send resource created JSON response (HTTP 201)
   */
  static created(res, data = null, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * Send error JSON response
   */
  static error(res, message = 'An error occurred', statusCode = 500, extra = {}) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...extra
    });
  }
}

module.exports = ApiResponse;
