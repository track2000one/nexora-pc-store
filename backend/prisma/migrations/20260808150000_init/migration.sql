-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "badge" TEXT,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "oldPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "imageUrl" TEXT,
    "imageDriveId" TEXT,
    "specs" JSONB NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_status_featured_idx" ON "Product"("status", "featured");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Initial catalog data. Inserts are safe because this migration runs once.
INSERT INTO "Category" ("id", "name", "slug", "description", "updatedAt") VALUES
('cat_parts', 'قطع التجميع', 'parts', 'بطاقات رسومية وقطع كمبيوتر عالية الأداء', CURRENT_TIMESTAMP),
('cat_monitors', 'الشاشات', 'monitors', 'شاشات ألعاب وإنتاجية عالية الدقة', CURRENT_TIMESTAMP),
('cat_accessories', 'الملحقات', 'accessories', 'لوحات مفاتيح وماوس وسماعات وملحقات ألعاب', CURRENT_TIMESTAMP);

INSERT INTO "Product" (
  "id", "name", "slug", "sku", "description", "categoryId", "badge", "rating", "price", "oldPrice",
  "currency", "imageUrl", "imageDriveId", "specs", "stock", "featured", "status", "updatedAt"
) VALUES
(
  'prod_gpu_5070ti', 'AURORA RTX 5070 Ti', 'aurora-rtx-5070-ti', 'NX-GPU-5070TI',
  'بطاقة رسومية احترافية للألعاب والرندر مع تقنيات تتبع الأشعة وDLSS.', 'cat_parts', 'NEW', 4.9, 4999.00, 5699.00,
  'SAR', 'https://drive.google.com/uc?export=view&id=12oaRdfihInZIN8htJA5-mvdTDPMJQKw3', '12oaRdfihInZIN8htJA5-mvdTDPMJQKw3',
  '["16GB GDDR7","DLSS 4","Ray Tracing","OC Edition"]'::jsonb, 12, true, 'ACTIVE', CURRENT_TIMESTAMP
),
(
  'prod_monitor_27qx', 'NEXUS 27QX', 'nexus-27qx', 'NX-MON-27QX',
  'شاشة ألعاب QHD سريعة بمعدل تحديث 240Hz ودعم تقنيات المزامنة.', 'cat_monitors', 'BEST SELLER', 4.8, 2799.00, 3299.00,
  'SAR', 'https://drive.google.com/uc?export=view&id=1X0FcogYb3YMtXeryoRehetXlr8ffn1rO', '1X0FcogYb3YMtXeryoRehetXlr8ffn1rO',
  '["27-inch QHD IPS","240Hz","1ms GTG","G-SYNC Compatible"]'::jsonb, 18, true, 'ACTIVE', CURRENT_TIMESTAMP
),
(
  'prod_keyboard_k1', 'VORTEX K1 PRO', 'vortex-k1-pro', 'NX-KB-K1PRO',
  'لوحة مفاتيح ميكانيكية احترافية لاسلكية بإضاءة RGB وهيكل ألمنيوم.', 'cat_accessories', 'LIMITED', 4.7, 649.00, 899.00,
  'SAR', 'https://drive.google.com/uc?export=view&id=1jZIN6G_BMcerAF2Sanuy5TPWelaqnP8l', '1jZIN6G_BMcerAF2Sanuy5TPWelaqnP8l',
  '["Hot-Swappable Switches","PBT Keycaps","RGB Per-Key","Aluminum Frame"]'::jsonb, 25, true, 'ACTIVE', CURRENT_TIMESTAMP
);
