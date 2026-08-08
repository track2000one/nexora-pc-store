import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email().max(180),
  customerPhone: z.string().min(7).max(30),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().min(1).max(99)
    })
  ).min(1).max(50)
});

const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
});

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function serializeOrder(order) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    items: order.items?.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal)
    }))
  };
}

router.post('/', async (req, res, next) => {
  try {
    const parsed = createOrderSchema.parse(req.body);

    const quantities = new Map();
    for (const item of parsed.items) {
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    }

    const productIds = [...quantities.keys()];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable.' });
    }

    const currencies = new Set(products.map((product) => product.currency));
    if (currencies.size !== 1) {
      return res.status(400).json({ error: 'Mixed currencies are not supported.' });
    }

    const lineItems = products.map((product) => {
      const quantity = quantities.get(product.id);
      const unitPrice = money(product.price);
      const lineTotal = money(unitPrice * quantity);
      return { product, quantity, unitPrice, lineTotal };
    });

    const subtotal = money(lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
    const shipping = 0;
    const total = money(subtotal + shipping);
    const currency = products[0].currency;
    const orderNumber = `NX-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      for (const item of lineItems) {
        const result = await tx.product.updateMany({
          where: {
            id: item.product.id,
            status: 'ACTIVE',
            stock: { gte: item.quantity }
          },
          data: { stock: { decrement: item.quantity } }
        });

        if (result.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${item.product.id}`);
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          customerName: parsed.customerName,
          customerEmail: parsed.customerEmail.toLowerCase(),
          customerPhone: parsed.customerPhone,
          subtotal: subtotal.toFixed(2),
          shipping: shipping.toFixed(2),
          total: total.toFixed(2),
          currency,
          items: {
            create: lineItems.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              productSku: item.product.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              lineTotal: item.lineTotal.toFixed(2)
            }))
          }
        },
        include: { items: true }
      });
    });

    res.status(201).json({ data: serializeOrder(order) });
  } catch (error) {
    if (String(error?.message || '').startsWith('INSUFFICIENT_STOCK:')) {
      return res.status(409).json({ error: 'Insufficient stock for one or more products.' });
    }
    next(error);
  }
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const orders = await prisma.order.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ data: orders.map(serializeOrder), count: orders.length });
  } catch (error) {
    next(error);
  }
});

router.get('/:orderNumber', requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ data: serializeOrder(order) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true }
    });
    res.json({ data: serializeOrder(order) });
  } catch (error) {
    next(error);
  }
});

export default router;
