import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/admin.js';
import { prisma } from '../lib/prisma.js';
import { inspectGoogleDrive, uploadProductImage } from '../lib/googleDrive.js';
import { ensureLegacyGalleryImage, mediaUrl } from '../lib/productImages.js';

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

function galleryImage(image, req) {
  return {
    id: image.id,
    driveId: image.driveId,
    url: mediaUrl(req, image.driveId),
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary
  };
}

async function productBySku(sku) {
  if (!sku) return null;
  return prisma.product.findUnique({ where: { sku } });
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

router.get('/product-gallery', requireAdmin, async (req, res, next) => {
  try {
    const sku = String(req.query.sku || '').trim();
    if (!sku) return res.status(400).json({ error: 'SKU is required.' });

    const product = await productBySku(sku);
    if (!product) {
      return res.status(404).json({
        error: 'PRODUCT_NOT_SAVED',
        message: 'احفظ المنتج أولاً ثم افتحه من جديد لإضافة صور المعرض.'
      });
    }

    await ensureLegacyGalleryImage(prisma, product);
    const images = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    res.json({
      data: {
        productId: product.id,
        sku: product.sku,
        images: images.map((image) => galleryImage(image, req)),
        maxImages: 10
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

    const sku = String(req.body.productSku || '').trim();
    const product = await productBySku(sku);

    if (product) {
      await ensureLegacyGalleryImage(prisma, product);
      const currentCount = await prisma.productImage.count({ where: { productId: product.id } });
      if (currentCount >= 10) {
        return res.status(409).json({ error: 'يمكن إضافة 10 صور كحد أقصى لكل منتج.' });
      }
    }

    const uploaded = await uploadProductImage(req.file);
    let attachedImage = null;

    if (product) {
      const currentCount = await prisma.productImage.count({ where: { productId: product.id } });
      const shouldBePrimary = currentCount === 0 && !product.imageDriveId;

      attachedImage = await prisma.productImage.create({
        data: {
          productId: product.id,
          driveId: uploaded.fileId,
          imageUrl: uploaded.imageUrl,
          altText: product.name,
          sortOrder: currentCount,
          isPrimary: shouldBePrimary
        }
      });

      if (shouldBePrimary || !product.imageDriveId) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            imageDriveId: uploaded.fileId,
            imageUrl: uploaded.imageUrl
          }
        });
      }
    }

    res.status(201).json({
      data: {
        ...uploaded,
        imageUrl: mediaUrl(req, uploaded.fileId),
        galleryAttached: Boolean(attachedImage),
        galleryImage: attachedImage ? galleryImage(attachedImage, req) : null,
        productSaved: Boolean(product)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/product-gallery/:imageId/primary', requireAdmin, async (req, res, next) => {
  try {
    const image = await prisma.productImage.findUnique({
      where: { id: req.params.imageId },
      include: { product: true }
    });
    if (!image) return res.status(404).json({ error: 'Gallery image not found.' });

    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId: image.productId },
        data: { isPrimary: false }
      }),
      prisma.productImage.update({
        where: { id: image.id },
        data: { isPrimary: true }
      }),
      prisma.product.update({
        where: { id: image.productId },
        data: { imageDriveId: image.driveId, imageUrl: image.imageUrl }
      })
    ]);

    res.json({ data: { ...galleryImage({ ...image, isPrimary: true }, req), primary: true } });
  } catch (error) {
    next(error);
  }
});

router.patch('/product-gallery/reorder', requireAdmin, async (req, res, next) => {
  try {
    const imageIds = Array.isArray(req.body?.imageIds) ? req.body.imageIds : [];
    if (!imageIds.length) return res.status(400).json({ error: 'imageIds is required.' });

    const images = await prisma.productImage.findMany({ where: { id: { in: imageIds } } });
    const productIds = new Set(images.map((image) => image.productId));
    if (images.length !== imageIds.length || productIds.size !== 1) {
      return res.status(400).json({ error: 'Invalid gallery image order.' });
    }

    await prisma.$transaction(
      imageIds.map((id, index) => prisma.productImage.update({ where: { id }, data: { sortOrder: index } }))
    );

    res.json({ data: { reordered: true } });
  } catch (error) {
    next(error);
  }
});

router.delete('/product-gallery/:imageId', requireAdmin, async (req, res, next) => {
  try {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId } });
    if (!image) return res.status(404).json({ error: 'Gallery image not found.' });

    const images = await prisma.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
    });
    if (images.length <= 1) {
      return res.status(409).json({ error: 'يجب الاحتفاظ بصورة واحدة على الأقل للمنتج.' });
    }

    await prisma.productImage.delete({ where: { id: image.id } });

    if (image.isPrimary) {
      const nextImage = images.find((candidate) => candidate.id !== image.id);
      if (nextImage) {
        await prisma.$transaction([
          prisma.productImage.update({ where: { id: nextImage.id }, data: { isPrimary: true } }),
          prisma.product.update({
            where: { id: image.productId },
            data: { imageDriveId: nextImage.driveId, imageUrl: nextImage.imageUrl }
          })
        ]);
      }
    }

    res.json({ data: { removed: true, id: image.id } });
  } catch (error) {
    next(error);
  }
});

export default router;
