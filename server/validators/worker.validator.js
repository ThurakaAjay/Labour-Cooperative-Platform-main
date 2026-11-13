/**
 * Worker Input Validators
 */

const validateCreateWorker = (req) => {
  const { name, phone, skill } = req.body || {};

  if (!name || !phone || !skill) {
    return {
      isValid: false,
      message: 'Missing required fields: name, phone, and skill are required.'
    };
  }

  return { isValid: true };
};

const validateReviewVerification = (req) => {
  const { decision, rejectionReason } = req.body || {};

  if (!decision || !['approve', 'reject'].includes(decision)) {
    return {
      isValid: false,
      message: "Invalid or missing 'decision': must be 'approve' or 'reject'."
    };
  }

  if (decision === 'reject' && !rejectionReason?.trim()) {
    return {
      isValid: false,
      message: 'A rejection reason is required when rejecting verification documents.'
    };
  }

  return { isValid: true };
};

module.exports = {
  validateCreateWorker,
  validateReviewVerification
};
