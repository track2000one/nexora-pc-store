import './adminUpload.css';

const SESSION_KEY = 'nexora_admin_session_v1';
const API_URL = import.meta.env.VITE_API_URL || 'https://nexora-backend-production-4e78.up.railway.app';
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function setReactInputValue(input, value) {
  if (!input) return;
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findMediaInputs(container) {
  const labels = [...container.querySelectorAll('.admin-field')];
  const driveLabel = labels.find((label) => label.textContent.includes('Google Drive File ID'));
  const urlLabel = labels.find((label) => label.textContent.includes('رابط صورة مباشر'));
  return {
    driveInput: driveLabel?.querySelector('input') || null,
    urlInput: urlLabel?.querySelector('input') || null
  };
}

function findSkuInput(root) {
  const form = root.closest('form') || document;
  const label = [...form.querySelectorAll('.admin-field')].find((item) => item.textContent.includes('SKU'));
  return label?.querySelector('input') || null;
}

function productSku(root) {
  return String(findSkuInput(root)?.value || '').trim();
}

function token() {
  return sessionStorage.getItem(SESSION_KEY) || '';
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token()}`, ...extra };
}

function renderStatus(node, message, type = 'idle') {
  node.dataset.state = type;
  node.textContent = message;
}

function apiErrorMessage(payload, fallback) {
  return [payload?.error || fallback, payload?.message, payload?.hint, payload?.missingConfiguration]
    .filter(Boolean)
    .join(' — ');
}

function fileSizeLabel(file) {
  return `${(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 2 : 3)} MB`;
}

function setLocalFileInfo(root, message) {
  const info = root.querySelector('.admin-upload-file-info');
  if (!info) return;
  info.textContent = message;
  info.hidden = !message;
}

async function checkReadiness(suite) {
  const root = suite.querySelector('.admin-device-uploader');
  const status = root.querySelector('.admin-upload-status');
  const button = root.querySelector('.admin-upload-button');
  if (!token()) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/status`, { headers: authHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر فحص Google Drive'));

    if (payload.data?.configured && payload.data?.connected !== false) {
      root.dataset.ready = 'true';
      button.disabled = false;
      const folderName = payload.data?.folder?.name;
      renderStatus(status, folderName ? `Google Drive متصل — المجلد: ${folderName}` : 'Google Drive متصل — جاهز للرفع', 'success');
      await loadGallery(suite);
    } else {
      root.dataset.ready = 'false';
      button.disabled = true;
      const missing = (payload.data?.missing || []).join(', ');
      renderStatus(status, `يلزم إكمال إعداد Google Drive في Railway${missing ? `: ${missing}` : ''}`, 'warning');
    }
  } catch (error) {
    root.dataset.ready = 'false';
    button.disabled = true;
    renderStatus(status, error.message || 'تعذر فحص إعداد Google Drive.', 'error');
  }
}

function galleryPlaceholder(gallery, message) {
  gallery.innerHTML = `<div class="admin-gallery-empty">${message}</div>`;
}

async function setPrimary(suite, imageId) {
  const gallery = suite.querySelector('.admin-product-gallery');
  gallery.classList.add('is-busy');
  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/product-gallery/${encodeURIComponent(imageId)}/primary`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر تغيير الصورة الرئيسية.'));

    const mediaFields = suite.closest('.admin-media-fields') || document;
    const { driveInput, urlInput } = findMediaInputs(mediaFields);
    setReactInputValue(driveInput, payload.data.driveId || '');
    setReactInputValue(urlInput, payload.data.url || '');
    await loadGallery(suite);
  } catch (error) {
    galleryPlaceholder(gallery, error.message || 'تعذر تغيير الصورة الرئيسية.');
  } finally {
    gallery.classList.remove('is-busy');
  }
}

async function removeImage(suite, imageId) {
  const gallery = suite.querySelector('.admin-product-gallery');
  if (!window.confirm('إزالة هذه الصورة من معرض المنتج؟')) return;
  gallery.classList.add('is-busy');
  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/product-gallery/${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر إزالة الصورة.'));
    await loadGallery(suite);
  } catch (error) {
    galleryPlaceholder(gallery, error.message || 'تعذر إزالة الصورة.');
  } finally {
    gallery.classList.remove('is-busy');
  }
}

async function reorderGallery(suite, imageIds) {
  const gallery = suite.querySelector('.admin-product-gallery');
  gallery.classList.add('is-busy');
  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/product-gallery/reorder`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imageIds })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر ترتيب الصور.'));
    await loadGallery(suite);
  } catch (error) {
    galleryPlaceholder(gallery, error.message || 'تعذر ترتيب الصور.');
  } finally {
    gallery.classList.remove('is-busy');
  }
}

function renderGallery(suite, images) {
  const gallery = suite.querySelector('.admin-product-gallery');
  const count = suite.querySelector('.admin-gallery-count');
  suite.dataset.productSaved = 'true';
  suite.dataset.galleryCount = String(images.length);
  count.textContent = `${images.length} / ${MAX_IMAGES}`;

  if (!images.length) {
    galleryPlaceholder(gallery, 'لا توجد صور في المعرض بعد. ارفع صورة أو أكثر من جهازك.');
    return;
  }

  gallery.innerHTML = '';
  images.forEach((image, index) => {
    const card = document.createElement('article');
    card.className = `admin-gallery-card${image.isPrimary ? ' is-primary' : ''}`;
    card.innerHTML = `
      <div class="admin-gallery-thumb"><img src="${image.url}" alt="${image.altText || 'صورة المنتج'}"></div>
      <div class="admin-gallery-card-info">
        <span>${image.isPrimary ? 'الصورة الرئيسية' : `صورة ${index + 1}`}</span>
        <small>${image.driveId ? 'Google Drive' : ''}</small>
      </div>
      <div class="admin-gallery-actions">
        ${image.isPrimary ? '<b>رئيسية</b>' : '<button type="button" data-action="primary">تعيين رئيسية</button>'}
        <button type="button" data-action="prev" ${index === 0 ? 'disabled' : ''} title="تحريك للأمام">‹</button>
        <button type="button" data-action="next" ${index === images.length - 1 ? 'disabled' : ''} title="تحريك للخلف">›</button>
        <button type="button" data-action="remove" class="danger">حذف</button>
      </div>
    `;

    card.querySelector('[data-action="primary"]')?.addEventListener('click', () => setPrimary(suite, image.id));
    card.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeImage(suite, image.id));
    card.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      const ids = images.map((item) => item.id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      reorderGallery(suite, ids);
    });
    card.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      const ids = images.map((item) => item.id);
      [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
      reorderGallery(suite, ids);
    });
    gallery.appendChild(card);
  });
}

async function loadGallery(suite) {
  const gallery = suite.querySelector('.admin-product-gallery');
  const count = suite.querySelector('.admin-gallery-count');
  const sku = productSku(suite);

  if (!sku) {
    suite.dataset.productSaved = 'false';
    suite.dataset.galleryCount = '0';
    count.textContent = `0 / ${MAX_IMAGES}`;
    galleryPlaceholder(gallery, 'أدخل SKU أولاً. بعد حفظ المنتج يمكنك إضافة عدة صور وزوايا مختلفة.');
    return;
  }

  galleryPlaceholder(gallery, 'جاري تحميل معرض الصور...');
  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/product-gallery?sku=${encodeURIComponent(sku)}`, {
      headers: authHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404 && payload.error === 'PRODUCT_NOT_SAVED') {
      suite.dataset.productSaved = 'false';
      suite.dataset.galleryCount = '0';
      count.textContent = `0 / ${MAX_IMAGES}`;
      galleryPlaceholder(gallery, 'المنتج جديد: ارفع الصورة الرئيسية الآن، احفظ المنتج، ثم افتحه مرة أخرى لإضافة بقية الزوايا.');
      return;
    }
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر تحميل معرض الصور.'));
    renderGallery(suite, payload.data?.images || []);
  } catch (error) {
    galleryPlaceholder(gallery, error.message || 'تعذر تحميل معرض الصور.');
  }
}

async function uploadFiles(files, suite) {
  const root = suite.querySelector('.admin-device-uploader');
  const status = root.querySelector('.admin-upload-status');
  const button = root.querySelector('.admin-upload-button');
  const progress = root.querySelector('.admin-upload-progress > i');
  const validFiles = [...files].filter(Boolean);

  if (!validFiles.length || root.dataset.uploading === 'true') return;
  if (root.dataset.ready !== 'true') {
    renderStatus(status, 'Google Drive غير جاهز. أعد فتح نافذة المنتج بعد اكتمال نشر الـBackend.', 'warning');
    return;
  }

  for (const file of validFiles) {
    if (!ALLOWED_TYPES.has(file.type)) {
      renderStatus(status, `الصيغة غير مدعومة: ${file.name}`, 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      renderStatus(status, `${file.name}: حجم الصورة أكبر من 10 MB.`, 'error');
      return;
    }
  }

  const savedProduct = suite.dataset.productSaved === 'true';
  if (!savedProduct && validFiles.length > 1) {
    renderStatus(status, 'للمنتج الجديد ارفع صورة رئيسية واحدة، احفظ المنتج، ثم افتحه لإضافة بقية الصور.', 'warning');
    return;
  }

  const existingCount = Number(suite.dataset.galleryCount || 0);
  if (savedProduct && existingCount + validFiles.length > MAX_IMAGES) {
    renderStatus(status, `الحد الأقصى ${MAX_IMAGES} صور لكل منتج.`, 'warning');
    return;
  }

  root.dataset.uploading = 'true';
  button.disabled = true;
  root.classList.add('uploading');
  const sku = productSku(suite);
  let uploadedCount = 0;

  try {
    for (let index = 0; index < validFiles.length; index += 1) {
      const file = validFiles[index];
      setLocalFileInfo(root, `${file.name} • ${fileSizeLabel(file)} • ${index + 1}/${validFiles.length}`);
      progress.style.width = `${Math.max(12, Math.round((index / validFiles.length) * 78))}%`;
      renderStatus(status, `جاري رفع الصورة ${index + 1} من ${validFiles.length} إلى Google Drive...`, 'uploading');

      const form = new FormData();
      form.append('file', file, file.name);
      if (sku) form.append('productSku', sku);

      const response = await fetch(`${API_URL}/api/admin/uploads/product-image`, {
        method: 'POST',
        headers: authHeaders(),
        body: form
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'تعذر رفع الصورة.'));

      uploadedCount += 1;
      const mediaFields = suite.closest('.admin-media-fields') || document;
      const { driveInput, urlInput } = findMediaInputs(mediaFields);
      const hasPrimary = String(driveInput?.value || '').trim();
      if (!hasPrimary || !savedProduct) {
        setReactInputValue(driveInput, payload.data.fileId || '');
        setReactInputValue(urlInput, payload.data.imageUrl || '');
      }
    }

    progress.style.width = '100%';
    renderStatus(status, `تم رفع ${uploadedCount} ${uploadedCount === 1 ? 'صورة' : 'صور'} بنجاح إلى معرض المنتج.`, 'success');
    if (savedProduct) await loadGallery(suite);
  } catch (error) {
    progress.style.width = '0%';
    renderStatus(status, error.message || 'تعذر رفع الصور.', 'error');
  } finally {
    root.dataset.uploading = 'false';
    window.setTimeout(() => {
      root.classList.remove('uploading');
      button.disabled = root.dataset.ready !== 'true';
      if (progress.style.width === '100%') progress.style.width = '0%';
    }, 900);
  }
}

function buildUploader() {
  const suite = document.createElement('div');
  suite.className = 'admin-gallery-suite';
  suite.dataset.productSaved = 'false';
  suite.dataset.galleryCount = '0';
  suite.innerHTML = `
    <div class="admin-device-uploader" data-ready="checking" data-uploading="false">
      <input class="admin-upload-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden>
      <div class="admin-upload-visual" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 15v4h14v-4"/></svg>
      </div>
      <div class="admin-upload-copy">
        <b>رفع صور المنتج من الجهاز</b>
        <span>اختر عدة صور لعرض المنتج من جميع الجهات</span>
        <small>حتى ${MAX_IMAGES} صور • JPG, PNG, WEBP, GIF, AVIF • 10 MB لكل صورة • تُرفع إلى Google Drive</small>
        <div class="admin-upload-file-info" hidden></div>
        <div class="admin-upload-status" data-state="uploading">جاري فحص اتصال Google Drive...</div>
        <div class="admin-upload-progress"><i></i></div>
      </div>
      <button type="button" class="admin-upload-button" disabled>اختيار الصور</button>
    </div>
    <div class="admin-gallery-head">
      <div><b>معرض صور المنتج</b><small>اختر الصورة الرئيسية ورتّب الزوايا التي سيشاهدها العميل</small></div>
      <span class="admin-gallery-count">0 / ${MAX_IMAGES}</span>
    </div>
    <div class="admin-product-gallery"><div class="admin-gallery-empty">جاري تجهيز المعرض...</div></div>
  `;

  const root = suite.querySelector('.admin-device-uploader');
  const input = suite.querySelector('.admin-upload-input');
  const button = suite.querySelector('.admin-upload-button');

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (root.dataset.uploading !== 'true') input.click();
  });

  input.addEventListener('change', () => {
    uploadFiles(input.files || [], suite);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    root.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (root.dataset.ready === 'true' && root.dataset.uploading !== 'true') root.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    root.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      root.classList.remove('dragging');
    });
  });
  root.addEventListener('drop', (event) => uploadFiles(event.dataTransfer?.files || [], suite));

  window.setTimeout(() => {
    const skuInput = findSkuInput(suite);
    if (skuInput && skuInput.dataset.nexoraGalleryBound !== 'true') {
      skuInput.dataset.nexoraGalleryBound = 'true';
      let timer;
      skuInput.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => loadGallery(suite), 450);
      });
    }
    checkReadiness(suite);
  }, 0);

  return suite;
}

function enhanceAdminMediaEditor() {
  if (!window.location.pathname.startsWith('/admin')) return;
  document.querySelectorAll('.admin-media-fields').forEach((fields) => {
    if (fields.querySelector('.admin-gallery-suite')) return;
    fields.prepend(buildUploader());
  });
}

if (window.location.pathname.startsWith('/admin')) {
  const observer = new MutationObserver(enhanceAdminMediaEditor);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', enhanceAdminMediaEditor);
  enhanceAdminMediaEditor();
}
