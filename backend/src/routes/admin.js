import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createAdminToken, requireAdmin, verifyAdminKey } from '../middleware/admin.js';
import { serializeProduct } from '../lib/productImages.js';

const router = Router();

router.post('/login', (req, res) => {
  const { key } = z.object({ key: z.string().min(16).max(500) }).parse(req.body);
  if (!verifyAdminKey(key)) {
    return res.status(401).json({ error: 'Invalid admin access key' });
  }

  const session = createAdminToken();
  res.json({
    ...session,
    admin: { role: 'admin', name: 'NEXORA Admin' }
  });
});

router.get('/session', requireAdmin, (req, res) => {
  res.json({ authenticated: true, admin: { role: 'admin' }, expiresAt: req.admin?.exp || null });
});

router.get('/overview', requireAdmin, async (_req, res, next) => {
  try {
    const [activeProducts, draftProducts, archivedProducts, lowStock, categories, orders, stockAggregate] =
      await Promise.all([
        prisma.product.count({ where: { status: 'ACTIVE' } }),
        prisma.product.count({ where: { status: 'DRAFT' } }),
        prisma.product.count({ where: { status: 'ARCHIVED' } }),
        prisma.product.count({ where: { status: 'ACTIVE', stock: { lte: 5 } } }),
        prisma.category.count(),
        prisma.order.count(),
        prisma.product.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { stock: true }
        })
      ]);

    res.json({
      data: {
        activeProducts,
        draftProducts,
        archivedProducts,
        lowStock,
        categories,
        orders,
        totalStock: stockAggregate._sum.stock || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'ALL').toUpperCase();

    const products = await prisma.product.findMany({
      where: {
        ...(status !== 'ALL' ? { status } : {}),
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
      include: {
        category: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }
      },
      orderBy: [{ status: 'asc' }, { featured: 'desc' }, { updatedAt: 'desc' }]
    });

    res.json({ data: products.map((product) => serializeProduct(product, req)), count: products.length });
  } catch (error) {
    next(error);
  }
});

export default router;
