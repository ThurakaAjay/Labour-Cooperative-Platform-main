/**
 * Utility to sanitize and escape special regex characters from user input
 * to prevent ReDoS (Regular Expression Denial of Service) and regex injection.
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = escapeRegex;
