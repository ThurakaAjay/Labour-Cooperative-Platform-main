const multer = require('multer');

// Worker KYC / trade-certificate documents: PDF, JPG, or PNG only.
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_DOCUMENTS_PER_REQUEST = 5;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`Unsupported file type '${file.mimetype}'. Only PDF, JPG, or PNG documents are allowed.`));
  }
  cb(null, true);
};

const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per document
    files: MAX_DOCUMENTS_PER_REQUEST
  }
}).array('documents', MAX_DOCUMENTS_PER_REQUEST);

// Wraps multer's callback-style middleware so a rejected upload (bad type,
// too large, too many files) surfaces as a normal JSON 400 instead of an
// unhandled throw.
const handleDocumentUpload = (req, res, next) => {
  uploadDocuments(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = { handleDocumentUpload };
