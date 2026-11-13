/**
 * Poll Input Validators
 */

const validateCreatePoll = (req) => {
  const { title, description } = req.body || {};

  if (!title?.trim() || !description?.trim()) {
    return {
      isValid: false,
      message: 'Title and description are required.'
    };
  }

  return { isValid: true };
};

const validateVote = (req) => {
  const { choice } = req.body || {};

  if (!choice || !['yes', 'no'].includes(choice)) {
    return {
      isValid: false,
      message: "Invalid or missing 'choice': must be 'yes' or 'no'."
    };
  }

  return { isValid: true };
};

module.exports = {
  validateCreatePoll,
  validateVote
};
