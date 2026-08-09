import './storefrontGalleryEnhancer.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://nexora-backend-production-4e78.up.railway.app';
const MAX_VISIBLE = 5;

if (!window.location.pathname.startsWith('/admin')) {
  let productMap = new Map();
  let loadingPromise = null;

  const key = (value) => String(value || '').trim().toLocaleLowerCase('ar');

  async function loadProducts() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = fetch(`${API_URL}/api/products`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const products = Array.isArray(payload?.data) ? payload.data : [];
        productMap = new Map(
          products.map((product) => [
            key(product.name),
            {
              id: product.id,
              name: product.name,
              images: (Array.isArray(product.images) ? product.images : [])
                .map((image, index) => ({
                  id: image.id || `${product.id}-${index}`,
                  url: image.url || image.imageUrl || '',
                  altText: image.altText || product.name,
                  isPrimary: Boolean(image.isPrimary),
                  sortOrder: Number(image.sortOrder ?? index)
                }))
                .filter((image) => image.url)
                .sort((a, b) => {
                  if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
                  return a.sortOrder - b.sortOrder;
                })
            }
          ])
        );
        return productMap;
      })
      .catch((error) => {
        console.warn('NEXORA card gallery could not load:', error);
        productMap = new Map();
        return productMap;
      });
    return loadingPromise;
  }

  function sameUrl(a, b) {
    try {
      return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
    } catch {
      return a === b;
    }
  }

  function applyActive(card, strip, images, index) {
    const mainImage = card.querySelector('.product-stage img');
    if (!mainImage || !images[index]) return;

    strip.dataset.activeIndex = String(index);
    strip.querySelectorAll('.card-gallery-thumb').forEach((button, buttonIndex) => {
      button.classList.toggle('active', buttonIndex === index);
      button.setAttribute('aria-pressed', buttonIndex === index ? 'true' : 'false');
    });

    const nextUrl = images[index].url;
    if (!sameUrl(mainImage.getAttribute('src') || mainImage.src, nextUrl)) {
      mainImage.classList.add('gallery-switching');
      mainImage.src = nextUrl;
      mainImage.alt = images[index].altText || '';
      mainImage.style.opacity = '1';
      window.requestAnimationFrame(() => {
        window.setTimeout(() => mainImage.classList.remove('gallery-switching'), 180);
      });
    }
  }

  function buildStrip(card, product) {
    const stage = card.querySelector('.product-stage');
    if (!stage || product.images.length <= 1) return;

    const strip = document.createElement('div');
    strip.className = 'card-mini-gallery';
    strip.dataset.galleryFor = product.id || product.name;
    strip.dataset.activeIndex = '0';
    strip.setAttribute('role', 'list');
    strip.setAttribute('aria-label', `صور ${product.name}`);

    const visibleImages = product.images.slice(0, MAX_VISIBLE);
    visibleImages.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `card-gallery-thumb${index === 0 ? ' active' : ''}`;
      button.setAttribute('aria-label', `عرض صورة ${index + 1} من ${product.images.length}`);
      button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      button.innerHTML = `<img src="${image.url}" alt="${image.altText || product.name}">`;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyActive(card, strip, product.images, index);
      });
      strip.appendChild(button);
    });

    if (product.images.length > MAX_VISIBLE) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'card-gallery-more';
      more.textContent = `+${product.images.length - MAX_VISIBLE}`;
      more.title = 'المزيد من صور المنتج — افتح العرض الكامل';
      const previewButton = card.querySelector('.actions button[aria-label="عرض المنتج"]');
      more.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        previewButton?.click();
      });
      strip.appendChild(more);
    }

    const badge = document.createElement('span');
    badge.className = 'card-gallery-total';
    badge.textContent = `${product.images.length} صور`;
    strip.appendChild(badge);

    stage.insertAdjacentElement('afterend', strip);
  }

  function enhanceCards() {
    if (!productMap.size) return;

    document.querySelectorAll('.product-card').forEach((card) => {
      const title = card.querySelector('h3')?.textContent;
      const product = productMap.get(key(title));
      if (!product || product.images.length <= 1) return;

      let strip = card.querySelector('.card-mini-gallery');
      if (!strip) {
        buildStrip(card, product);
        strip = card.querySelector('.card-mini-gallery');
      }
      if (!strip) return;

      const activeIndex = Math.min(
        Math.max(Number(strip.dataset.activeIndex || 0), 0),
        Math.min(product.images.length, MAX_VISIBLE) - 1
      );
      applyActive(card, strip, product.images, activeIndex);
    });
  }

  let queued = false;
  function queueEnhance() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      enhanceCards();
    });
  }

  loadProducts().then(() => {
    enhanceCards();
    const observer = new MutationObserver(queueEnhance);
    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  });
}
