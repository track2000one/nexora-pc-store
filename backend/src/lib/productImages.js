export function mediaUrl(req, driveId) {
  if (!driveId) return null;
  const host = req.get('host');
  const protocol = req.protocol || 'https';
  return `${protocol}://${host}/api/media/${encodeURIComponent(driveId)}`;
}

export function serializeProduct(product, req) {
  const gallery = Array.isArray(product.images) ? [...product.images] : [];
  const hasLegacy = product.imageDriveId && gallery.some((image) => image.driveId === product.imageDriveId);

  if (product.imageDriveId && !hasLegacy) {
    gallery.unshift({
      id: `legacy-${product.id}`,
      productId: product.id,
      driveId: product.imageDriveId,
      imageUrl: product.imageUrl || '',
      altText: product.name,
      sortOrder: -1,
      isPrimary: true,
      legacy: true
    });
  }

  gallery.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });

  const images = gallery.map((image, index) => ({
    id: image.id,
    driveId: image.driveId,
    url: image.driveId ? mediaUrl(req, image.driveId) : image.imageUrl,
    altText: image.altText || product.name,
    sortOrder: Number(image.sortOrder ?? index),
    isPrimary: Boolean(image.isPrimary || index === 0),
    legacy: Boolean(image.legacy)
  }));

  const primary = images.find((image) => image.isPrimary) || images[0] || null;

  return {
    ...product,
    images: images,
    imageUrl: primary?.url || product.imageUrl,
    imageDriveId: primary?.driveId || product.imageDriveId,
    rating: Number(product.rating),
    price: Number(product.price),
    oldPrice: product.oldPrice == null ? null : Number(product.oldPrice)
  };
}

export async function ensureLegacyGalleryImage(prisma, product) {
  if (!product?.imageDriveId) return;

  const existing = await prisma.productImage.findUnique({
    where: {
      productId_driveId: {
        productId: product.id,
        driveId: product.imageDriveId
      }
    }
  });

  if (existing) return existing;

  const count = await prisma.productImage.count({ where: { productId: product.id } });
  if (count > 0) return null;

  return prisma.productImage.create({
    data: {
      productId: product.id,
      driveId: product.imageDriveId,
      imageUrl: product.imageUrl || '',
      altText: product.name,
      sortOrder: 0,
      isPrimary: true
    }
  });
}
