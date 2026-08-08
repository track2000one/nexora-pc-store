import { Router } from 'express';
import { getProductImageStream } from '../lib/googleDrive.js';

const router = Router();

router.get('/:fileId', async (req, res, next) => {
  try {
    const image = await getProductImageStream(req.params.fileId);

    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (image.size != null) res.setHeader('Content-Length', String(image.size));
    if (image.modifiedTime) res.setHeader('Last-Modified', new Date(image.modifiedTime).toUTCString());

    image.stream.on('error', next);
    image.stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
