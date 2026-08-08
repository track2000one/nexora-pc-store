import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/admin.js';
import { inspectGoogleDrive, uploadProductImage } from '../lib/googleDrive.js';

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

function proxyUrl(req, fileId) {
  return `${req.protocol}://${req.get('host')}/api/media/${encodeURIComponent(fileId)}`;
}

router.get('/status', requireAdmin, async (_req, res, next) => {
  try {
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
    const missing = required.filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) {
      return res.json({
        data: {
          configured: false,
          connected: false,
          missing,
          maxFileSizeMb: 10,
          allowedTypes: [...allowedMimeTypes]
        }
      });
    }

    const drive = await inspectGoogleDrive();
    res.json({
      data: {
        configured: true,
        connected: true,
        missing: [],
        maxFileSizeMb: 10,
        allowedTypes: [...allowedMimeTypes],
        folder: drive.folder,
        configuredFolderAccessible: drive.configuredFolderAccessible
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/product-image', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose an image file to upload.' });
    }

    const uploaded = await uploadProductImage(req.file);
    res.status(201).json({
      data: {
        ...uploaded,
        imageUrl: proxyUrl(req, uploaded.fileId)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
