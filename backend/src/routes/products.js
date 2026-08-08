import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(2).max(140),
  slug: z.string().min(2).max(160).optional(),
  sku: z.string().min(2).max(80),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().min(1),
  badge: z.string().max(50).nullable().optional(),
  rating: z.coerce.number().min(0).max(5).default(0),
  price: z.coerce.number().nonnegative(),
  oldPrice: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('SAR'),
  imageUrl: z.string().url().nullable().optional(),
  imageDriveId: z.string().max(200).nullable().optional(),
  specs: z.array(z.string().min(1).max(140)).default([]),
  stock: z.coerce.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE')
});

const updateProductSchema = productSchema.partial();

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function proxyUrl(req, fileId) {
  if (!fileId) return null;
  return `${req.protocol}://${req.get('host')}/api/media/${encodeURIComponent(fileId)}`;
}

function serializeProduct(product, req) {
  return {
    ...product,
    rating: Number(product.rating),
    price: Number(product.price),
    oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
    imageUrl: product.imageDriveId ? proxyUrl(req, product.imageDriveId) : product.imageUrl
  };
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const featured = req.query.featured === 'true' ? true : undefined;

    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(featured === true ? { featured: true } : {}),
        ...(category ? { category: { slug: category } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: { category: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({ data: products.map((product) => serializeProduct(product, req)), count: products.length });
  } catch (error) {
    next(error);
  }
});

router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }]
      },
      include: { category: true }
    });

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: serializeProduct(product, req) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const parsed = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        ...parsed,
        slug: parsed.slug || slugify(parsed.name)
      },
      include: { category: true }
    });
    res.status(201).json({ data: serializeProduct(product, req) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const parsed = updateProductSchema.parse(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...parsed,
        ...(parsed.name && !parsed.slug ? { slug: slugify(parsed.name) } : {})
      },
      include: { category: true }
    });
    res.json({ data: serializeProduct(product, req) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
      include: { category: true }
    });
    res.json({ data: serializeProduct(product, req), archived: true });
  } catch (error) {
    next(error);
  }
});

export default router;
