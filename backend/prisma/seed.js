import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'cat_parts', name: 'قطع التجميع', slug: 'parts', description: 'بطاقات رسومية وقطع كمبيوتر عالية الأداء' },
  { id: 'cat_monitors', name: 'الشاشات', slug: 'monitors', description: 'شاشات ألعاب وإنتاجية عالية الدقة' },
  { id: 'cat_accessories', name: 'الملحقات', slug: 'accessories', description: 'لوحات مفاتيح وماوس وسماعات وملحقات ألعاب' }
];

const products = [
  {
    id: 'prod_gpu_5070ti', name: 'AURORA RTX 5070 Ti', slug: 'aurora-rtx-5070-ti', sku: 'NX-GPU-5070TI',
    description: 'بطاقة رسومية احترافية للألعاب والرندر مع تقنيات تتبع الأشعة وDLSS.', categoryId: 'cat_parts', badge: 'NEW',
    rating: 4.9, price: 4999, oldPrice: 5699, currency: 'SAR',
    imageUrl: 'https://drive.google.com/uc?export=view&id=12oaRdfihInZIN8htJA5-mvdTDPMJQKw3', imageDriveId: '12oaRdfihInZIN8htJA5-mvdTDPMJQKw3',
    specs: ['16GB GDDR7', 'DLSS 4', 'Ray Tracing', 'OC Edition'], stock: 12, featured: true, status: 'ACTIVE'
  },
  {
    id: 'prod_monitor_27qx', name: 'NEXUS 27QX', slug: 'nexus-27qx', sku: 'NX-MON-27QX',
    description: 'شاشة ألعاب QHD سريعة بمعدل تحديث 240Hz ودعم تقنيات المزامنة.', categoryId: 'cat_monitors', badge: 'BEST SELLER',
    rating: 4.8, price: 2799, oldPrice: 3299, currency: 'SAR',
    imageUrl: 'https://drive.google.com/uc?export=view&id=1X0FcogYb3YMtXeryoRehetXlr8ffn1rO', imageDriveId: '1X0FcogYb3YMtXeryoRehetXlr8ffn1rO',
    specs: ['27-inch QHD IPS', '240Hz', '1ms GTG', 'G-SYNC Compatible'], stock: 18, featured: true, status: 'ACTIVE'
  },
  {
    id: 'prod_keyboard_k1', name: 'VORTEX K1 PRO', slug: 'vortex-k1-pro', sku: 'NX-KB-K1PRO',
    description: 'لوحة مفاتيح ميكانيكية احترافية لاسلكية بإضاءة RGB وهيكل ألمنيوم.', categoryId: 'cat_accessories', badge: 'LIMITED',
    rating: 4.7, price: 649, oldPrice: 899, currency: 'SAR',
    imageUrl: 'https://drive.google.com/uc?export=view&id=1jZIN6G_BMcerAF2Sanuy5TPWelaqnP8l', imageDriveId: '1jZIN6G_BMcerAF2Sanuy5TPWelaqnP8l',
    specs: ['Hot-Swappable Switches', 'PBT Keycaps', 'RGB Per-Key', 'Aluminum Frame'], stock: 25, featured: true, status: 'ACTIVE'
  }
];

for (const category of categories) {
  await prisma.category.upsert({
    where: { slug: category.slug },
    update: {},
    create: category
  });
}

for (const product of products) {
  await prisma.product.upsert({
    where: { sku: product.sku },
    update: {},
    create: product
  });
}

console.log('NEXORA seed completed.');
await prisma.$disconnect();
