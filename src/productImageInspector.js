import './productImageInspector.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://nexora-backend-production-4e78.up.railway.app';

if (!window.location.pathname.startsWith('/admin')) {
  let products = new Map();
  let overlay = null;
  let activeImages = [];
  let activeIndex = 0;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseX = 0;
  let dragBaseY = 0;

  const key = (value) => String(value || '').trim().toLocaleLowerCase('ar');

  function normalizeProduct(product) {
    const images = (Array.isArray(product.images) ? product.images : [])
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
      });

    if (!images.length && product.imageUrl) {
      images.push({ id: `${product.id}-main`, url: product.imageUrl, altText: product.name, isPrimary: true, sortOrder: 0 });
    }

    return { id: product.id, name: product.name, images };
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/api/products`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      products = new Map((payload.data || []).map((product) => {
        const normalized = normalizeProduct(product);
        return [key(normalized.name), normalized];
      }));
    } catch (error) {
      console.warn('NEXORA image inspector could not load products:', error);
      products = new Map();
    }
  }

  function icon(path) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }

  const icons = {
    eye: icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: icon('<path d="M12 5v14M5 12h14"/>'),
    minus: icon('<path d="M5 12h14"/>'),
    reset: icon('<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 8.2A7 7 0 0 1 18 6l2 1M17.5 15.8A7 7 0 0 1 6 18l-2-1"/>'),
    left: icon('<path d="m15 18-6-6 6-6"/>'),
    right: icon('<path d="m9 18 6-6-6-6"/>')
  };

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'nx-inspector';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="nx-inspector-backdrop"></div>
      <section class="nx-inspector-panel" role="dialog" aria-modal="true" aria-label="معاينة صورة المنتج">
        <header class="nx-inspector-header">
          <div>
            <span>معاينة المنتج</span>
            <strong class="nx-inspector-title">المنتج</strong>
          </div>
          <button type="button" class="nx-inspector-close" aria-label="إغلاق">${icons.close}</button>
        </header>

        <div class="nx-inspector-toolbar" aria-label="أدوات التكبير">
          <button type="button" data-tool="zoom-in" title="تكبير">${icons.plus}<span>تكبير</span></button>
          <button type="button" data-tool="zoom-out" title="تصغير">${icons.minus}<span>تصغير</span></button>
          <button type="button" data-tool="reset" title="الحجم الطبيعي">${icons.reset}<span>100%</span></button>
          <b class="nx-inspector-scale">100%</b>
        </div>

        <div class="nx-inspector-stage">
          <button type="button" class="nx-inspector-nav nx-prev" aria-label="الصورة السابقة">${icons.right}</button>
          <div class="nx-inspector-viewport">
            <img class="nx-inspector-image" draggable="false" alt="" />
          </div>
          <button type="button" class="nx-inspector-nav nx-next" aria-label="الصورة التالية">${icons.left}</button>
          <div class="nx-inspector-hint">استخدم + و − للتكبير والتصغير • اسحب الصورة بعد التكبير</div>
        </div>

        <footer class="nx-inspector-footer">
          <div class="nx-inspector-thumbs" role="list"></div>
          <div class="nx-inspector-counter">1 / 1</div>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.nx-inspector-backdrop').addEventListener('click', closeInspector);
    overlay.querySelector('.nx-inspector-close').addEventListener('click', closeInspector);
    overlay.querySelector('.nx-prev').addEventListener('click', () => move(-1));
    overlay.querySelector('.nx-next').addEventListener('click', () => move(1));
    overlay.querySelector('[data-tool="zoom-in"]').addEventListener('click', () => setScale(scale + 0.25));
    overlay.querySelector('[data-tool="zoom-out"]').addEventListener('click', () => setScale(scale - 0.25));
    overlay.querySelector('[data-tool="reset"]').addEventListener('click', resetZoom);

    const viewport = overlay.querySelector('.nx-inspector-viewport');
    const image = overlay.querySelector('.nx-inspector-image');

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      setScale(scale + (event.deltaY < 0 ? 0.2 : -0.2));
    }, { passive: false });

    image.addEventListener('dblclick', () => setScale(scale > 1 ? 1 : 2));

    viewport.addEventListener('pointerdown', (event) => {
      if (scale <= 1) return;
      dragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragBaseX = translateX;
      dragBaseY = translateY;
      viewport.setPointerCapture?.(event.pointerId);
      viewport.classList.add('is-dragging');
    });

    viewport.addEventListener('pointermove', (event) => {
      if (!dragging || scale <= 1) return;
      translateX = dragBaseX + (event.clientX - dragStartX);
      translateY = dragBaseY + (event.clientY - dragStartY);
      applyTransform();
    });

    const stopDrag = () => {
      dragging = false;
      viewport.classList.remove('is-dragging');
    };
    viewport.addEventListener('pointerup', stopDrag);
    viewport.addEventListener('pointercancel', stopDrag);

    return overlay;
  }

  function applyTransform() {
    if (!overlay) return;
    const image = overlay.querySelector('.nx-inspector-image');
    const scaleLabel = overlay.querySelector('.nx-inspector-scale');
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    scaleLabel.textContent = `${Math.round(scale * 100)}%`;
    overlay.querySelector('[data-tool="reset"] span').textContent = scale === 1 ? '100%' : 'إعادة';
    overlay.querySelector('.nx-inspector-viewport').classList.toggle('can-drag', scale > 1);
  }

  function setScale(next) {
    scale = Math.min(4, Math.max(0.5, Number(next.toFixed(2))));
    if (scale <= 1) {
      translateX = 0;
      translateY = 0;
    }
    applyTransform();
  }

  function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function renderActive() {
    if (!overlay || !activeImages.length) return;
    const active = activeImages[activeIndex];
    const image = overlay.querySelector('.nx-inspector-image');
    image.classList.add('is-changing');
    image.src = active.url;
    image.alt = active.altText || '';
    resetZoom();
    window.setTimeout(() => image.classList.remove('is-changing'), 160);

    overlay.querySelector('.nx-inspector-counter').textContent = `${activeIndex + 1} / ${activeImages.length}`;
    const hasMany = activeImages.length > 1;
    overlay.querySelector('.nx-prev').hidden = !hasMany;
    overlay.querySelector('.nx-next').hidden = !hasMany;

    overlay.querySelectorAll('.nx-inspector-thumb').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === activeIndex);
      thumb.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    });
  }

  function renderThumbs() {
    const thumbs = overlay.querySelector('.nx-inspector-thumbs');
    thumbs.innerHTML = '';
    activeImages.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `nx-inspector-thumb${index === activeIndex ? ' active' : ''}`;
      button.setAttribute('aria-label', `عرض الصورة ${index + 1}`);
      button.innerHTML = `<img src="${image.url}" alt="${image.altText || ''}"><span>${index + 1}</span>`;
      button.addEventListener('click', () => {
        activeIndex = index;
        renderActive();
      });
      thumbs.appendChild(button);
    });
  }

  function move(direction) {
    if (activeImages.length < 2) return;
    activeIndex = (activeIndex + direction + activeImages.length) % activeImages.length;
    renderActive();
  }

  function openInspector(product, currentUrl = '') {
    ensureOverlay();
    activeImages = product.images || [];
    if (!activeImages.length) return;
    activeIndex = Math.max(0, activeImages.findIndex((image) => {
      try { return new URL(image.url, location.href).href === new URL(currentUrl, location.href).href; }
      catch { return image.url === currentUrl; }
    }));
    if (activeIndex < 0) activeIndex = 0;
    overlay.querySelector('.nx-inspector-title').textContent = product.name;
    renderThumbs();
    renderActive();
    overlay.hidden = false;
    document.documentElement.classList.add('nx-inspector-open');
  }

  function closeInspector() {
    if (!overlay) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('nx-inspector-open');
    resetZoom();
  }

  function addEyeButtons() {
    document.querySelectorAll('.product-card').forEach((card) => {
      const stage = card.querySelector('.product-stage');
      if (!stage || stage.querySelector('.nx-stage-eye')) return;
      const title = card.querySelector('h3')?.textContent || '';
      const product = products.get(key(title));
      if (!product?.images?.length) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nx-stage-eye';
      button.setAttribute('aria-label', 'تكبير صورة المنتج');
      button.title = 'مشاهدة الصورة عن قرب';
      button.innerHTML = `${icons.eye}<span>مشاهدة</span>`;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const currentUrl = stage.querySelector('img')?.src || product.images[0].url;
        openInspector(product, currentUrl);
      });
      stage.appendChild(button);
    });
  }

  function queueEnhance() {
    window.requestAnimationFrame(addEyeButtons);
  }

  document.addEventListener('keydown', (event) => {
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') closeInspector();
    if (event.key === 'ArrowLeft') move(1);
    if (event.key === 'ArrowRight') move(-1);
    if (event.key === '+' || event.key === '=') setScale(scale + 0.25);
    if (event.key === '-') setScale(scale - 0.25);
    if (event.key === '0') resetZoom();
  });

  loadProducts().then(() => {
    addEyeButtons();
    const root = document.getElementById('root') || document.body;
    const observer = new MutationObserver(queueEnhance);
    observer.observe(root, { childList: true, subtree: true });
  });
}
