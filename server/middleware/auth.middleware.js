const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? null : 'workhive_cooperative_secret_key_2026');

if (isProduction && !JWT_SECRET) {
  throw new Error('[Auth] Fatal: JWT_SECRET environment variable is required in production.');
}

// Required lazily (not at module load) to avoid a require-cycle with services
// that import JWT_SECRET from this file.
const getAccountStatus = async (decoded) => {
  if (decoded.role === 'worker') {
    const Worker = require('../models/Worker');
    const worker = await Worker.findOne({ workerId: decoded.userId }).select('status').lean();
    return worker?.status;
  }
  const User = require('../models/User');
  const user = await User.findOne({ userId: decoded.userId }).select('status').lean();
  return user?.status;
};

/**
 * Middleware: Verify JWT in Authorization header
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed authorization token.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Your authentication session has expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }

  // Re-check the account's current status on every request so a suspension
  // (e.g. from a complaint escalation) takes effect immediately, instead of
  // only once the 7-day token naturally expires.
  try {
    const currentStatus = await getAccountStatus(decoded);
    if (currentStatus === 'Suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: 'Your account has been suspended. Please contact the cooperative office.'
      });
    }
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Unable to verify account status right now. Please try again.'
    });
  }

  req.user = decoded;
  next();
};

/**
 * Middleware: Require one of the specified roles
 * @param  {...string} allowedRoles (e.g. 'admin', 'worker', 'customer')
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before role verification.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires role in [${allowedRoles.join(', ')}]. You have role '${req.user.role}'.`
      });
    }

    next();
  };
};

/**
 * Optional authentication: attaches user if token is valid, otherwise continues anonymously
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (!authHeader) return next();

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {
    // Continue without req.user
  }
  next();
};

module.exports = {
  authenticate,
  authorizeRole,
  optionalAuth,
  JWT_SECRET
};
