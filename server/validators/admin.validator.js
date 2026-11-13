/**
 * Admin RBAC Input Validators
 */

const validateUpdateStatus = (req) => {
  const { status } = req.body || {};

  if (!status || !['Active', 'Suspended'].includes(status)) {
    return {
      isValid: false,
      message: "Invalid or missing 'status': must be 'Active' or 'Suspended'."
    };
  }

  return { isValid: true };
};

module.exports = {
  validateUpdateStatus
};
