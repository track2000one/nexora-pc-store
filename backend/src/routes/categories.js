import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(120),
  description: z.string().max(1000).nullable().optional()
});

router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    res.json({ data: categories, count: categories.length });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data });
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data
    });
    res.json({ data: category });
  } catch (error) {
    next(error);
  }
});

export default router;
