/**
 * Async Handler Wrapper
 * Eliminates repetitive try/catch blocks in route controllers
 * Automatically passes caught errors to Express next()
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
