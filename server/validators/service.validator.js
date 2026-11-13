/**
 * Service Catalog Input Validators
 */

const validateCreateService = (req) => {
  const { title, description, baseRate, category } = req.body || {};

  if (!title || !description || !baseRate || !category) {
    return {
      isValid: false,
      message: 'Title, description, baseRate, and category are required'
    };
  }

  return { isValid: true };
};

module.exports = {
  validateCreateService
};
