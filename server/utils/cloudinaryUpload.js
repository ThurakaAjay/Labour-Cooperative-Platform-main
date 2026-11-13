const { cloudinary } = require('../config/cloudinary');

// Streams a memory-buffered file (from multer) straight to Cloudinary
// without touching disk. `resourceType` should be 'image' for photos or
// 'auto' when the upload may also be a PDF (Cloudinary stores non-image
// files as 'raw'/'auto' resources).
const streamUploadToCloudinary = (buffer, folder, resourceType = 'image') => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder,
      resource_type: resourceType,
      ...(resourceType === 'image' ? { transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }] } : {})
    },
    (err, result) => (err ? reject(err) : resolve(result))
  );
  stream.end(buffer);
});

module.exports = { streamUploadToCloudinary };
