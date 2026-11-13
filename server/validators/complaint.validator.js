/**
 * Complaint / Grievance Input Validators
 */

const validateCreateComplaint = (req) => {
  // `complainant`/`complainantPhone`/`complainantRole` are always derived
  // server-side from the authenticated user (see complaint.controller.js),
  // never accepted from the client — so they're intentionally not required
  // here even though the Complaint schema requires them.
  const { against, category, description } = req.body || {};

  if (!against || !category || !description) {
    return {
      isValid: false,
      message: 'Missing required complaint fields: against, category, description are required.'
    };
  }

  return { isValid: true };
};

module.exports = {
  validateCreateComplaint
};
