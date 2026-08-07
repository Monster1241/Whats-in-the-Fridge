import multer from 'multer';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_BYTES = 12 * 1024 * 1024;

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new Error('Unsupported file type. Use JPG, PNG, WEBP, or PDF.'),
    );
  },
});

/**
 * @param {string} fieldName
 */
export function receiptUploadMiddleware(fieldName = 'receipt') {
  return (req, res, next) => {
    receiptUpload.single(fieldName)(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Receipt file is too large (max 12 MB).'
            : err.message;
        res.status(400).json({ error: message });
        return;
      }
      res.status(400).json({ error: err.message || 'Invalid upload.' });
    });
  };
}
