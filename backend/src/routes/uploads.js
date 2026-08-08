import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/admin.js';
import { uploadProductImage } from '../lib/googleDrive.js';

const router = Router();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, PNG, WEBP, GIF, and AVIF images are allowed.');
      error.code = 'INVALID_IMAGE_TYPE';
      return callback(error);
    }
    callback(null, true);
  }
});

router.post('/product-image', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose an image file to upload.' });
    }

    const uploaded = await uploadProductImage(req.file);
    res.status(201).json({ data: uploaded });
  } catch (error) {
    next(error);
  }
});

export default router;
