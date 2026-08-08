# NEXORA Backend

Production API for the NEXORA PC Store.

## Stack

- Node.js 20+
- Express 5
- Prisma ORM 6.16
- PostgreSQL
- Railway

## API

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:idOrSlug`
- `GET /api/categories`
- `POST /api/orders`
- Admin product/category/order routes require the `x-admin-key` header.

## Railway service

Use the same GitHub repository and create a second Railway service for the API.

Service settings:

- Root Directory: `/backend`
- Config File Path: `/backend/railway.toml`
- Public domain: generate after successful deployment

Variables:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `FRONTEND_URL=https://nexora-pc-store-production.up.railway.app`
- `ADMIN_API_KEY=<long-random-secret>`
- `NODE_ENV=production`

Add a PostgreSQL service in the same Railway project before deploying the backend. The pre-deploy command runs `prisma migrate deploy`, which also inserts the initial NEXORA catalog through the first migration.

## Local development

```bash
npm install
npx prisma generate
npm run dev
```
