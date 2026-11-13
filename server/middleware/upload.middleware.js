const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`Unsupported file type '${file.mimetype}'. Only JPEG, PNG, WEBP, or HEIC images are allowed.`));
  }
  cb(null, true);
};

const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per photo
    files: 1
  }
}).single('photo');

// Wraps multer's callback-style middleware so a rejected upload (bad type,
// too large) surfaces as a normal JSON 400 instead of an unhandled throw.
const handleUpload = (req, res, next) => {
  uploadPhoto(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = { handleUpload };
