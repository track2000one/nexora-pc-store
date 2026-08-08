import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { ZodError } from 'zod';
import { prisma } from './lib/prisma.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import ordersRouter from './routes/orders.js';
import adminRouter from './routes/admin.js';
import uploadsRouter from './routes/uploads.js';

const app = express();
const port = Number(process.env.PORT || 3000);

const allowedOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/', (_req, res) => {
  res.json({
    name: 'NEXORA PC Store API',
    version: '1.2.0',
    status: 'online',
    endpoints: ['/api/health', '/api/products', '/api/categories', '/api/orders', '/api/admin', '/api/admin/uploads/product-image']
  });
});

app.get('/api/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/uploads', uploadsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.issues
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image is too large. Maximum size is 10 MB.' });
    }
    return res.status(400).json({ error: error.message || 'Invalid file upload.' });
  }

  if (error?.code === 'INVALID_IMAGE_TYPE' || error?.code === 'UPLOAD_FILE_MISSING') {
    return res.status(400).json({ error: error.message });
  }

  if (error?.code === 'GOOGLE_DRIVE_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Google Drive upload is not configured yet.', missingConfiguration: error.message });
  }

  if (error?.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'A unique value already exists.', fields: error.meta?.target });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  console.error(error);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' ? { message: error?.message } : {})
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`NEXORA API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
