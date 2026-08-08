import './adminUpload.css';

const SESSION_KEY = 'nexora_admin_session_v1';
const API_URL = import.meta.env.VITE_API_URL || 'https://nexora-backend-production-4e78.up.railway.app';
const MAX_SIZE = 10 * 1024 * 1024;
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

function updatePreview(url) {
  if (!url) return;
  const preview = document.querySelector('.admin-image-preview');
  if (!preview) return;
  let image = preview.querySelector('img');
  if (!image) {
    preview.innerHTML = '';
    image = document.createElement('img');
    image.alt = 'معاينة المنتج';
    preview.appendChild(image);
  }
  image.src = url;
}

function renderStatus(node, message, type = 'idle') {
  node.dataset.state = type;
  node.textContent = message;
}

async function checkReadiness(root) {
  const token = sessionStorage.getItem(SESSION_KEY);
  const status = root.querySelector('.admin-upload-status');
  const button = root.querySelector('.admin-upload-button');
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/uploads/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'تعذر فحص Google Drive');

    if (payload.data?.configured) {
      root.dataset.ready = 'true';
      button.disabled = false;
      renderStatus(status, 'Google Drive متصل — جاهز للرفع', 'success');
    } else {
      root.dataset.ready = 'false';
      button.disabled = true;
      const missing = (payload.data?.missing || []).join(', ');
      renderStatus(status, `يلزم إكمال إعداد Google Drive في Railway${missing ? `: ${missing}` : ''}`, 'warning');
    }
  } catch (error) {
    renderStatus(status, error.message || 'تعذر فحص إعداد Google Drive.', 'error');
  }
}

async function uploadFile(file, root) {
  const status = root.querySelector('.admin-upload-status');
  const button = root.querySelector('.admin-upload-button');
  const progress = root.querySelector('.admin-upload-progress > i');

  if (!file) return;
  if (root.dataset.ready === 'false') {
    renderStatus(status, 'أكمل إعداد Google Drive في Railway أولًا.', 'warning');
    return;
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    renderStatus(status, 'صيغة غير مدعومة. استخدم JPG أو PNG أو WEBP أو GIF أو AVIF.', 'error');
    return;
  }
  if (file.size > MAX_SIZE) {
    renderStatus(status, 'حجم الصورة أكبر من 10 MB.', 'error');
    return;
  }

  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    renderStatus(status, 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.', 'error');
    return;
  }

  const localUrl = URL.createObjectURL(file);
  updatePreview(localUrl);
  button.disabled = true;
  root.classList.add('uploading');
  progress.style.width = '38%';
  renderStatus(status, `جاري رفع ${file.name} إلى Google Drive...`, 'uploading');

  try {
    const form = new FormData();
    form.append('file', file, file.name);

    progress.style.width = '64%';
    const response = await fetch(`${API_URL}/api/admin/uploads/product-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const extra = payload.missingConfiguration ? ` ${payload.missingConfiguration}` : '';
      throw new Error((payload.error || 'تعذر رفع الصورة.') + extra);
    }

    progress.style.width = '100%';
    const { driveInput, urlInput } = findMediaInputs(root.closest('.admin-media-fields') || document);
    setReactInputValue(driveInput, payload.data.fileId || '');
    setReactInputValue(urlInput, payload.data.imageUrl || '');
    updatePreview(payload.data.imageUrl || localUrl);

    renderStatus(
      status,
      payload.data.publicPermission === false
        ? 'تم الرفع، لكن تعذر جعل الصورة عامة تلقائيًا. راجع صلاحية المشاركة في Drive.'
        : 'تم رفع الصورة إلى Google Drive وربطها بالمنتج بنجاح.',
      payload.data.publicPermission === false ? 'warning' : 'success'
    );
  } catch (error) {
    progress.style.width = '0%';
    renderStatus(status, error.message || 'تعذر رفع الصورة.', 'error');
  } finally {
    window.setTimeout(() => {
      root.classList.remove('uploading');
      button.disabled = root.dataset.ready === 'false';
      if (progress.style.width === '100%') progress.style.width = '0%';
      URL.revokeObjectURL(localUrl);
    }, 700);
  }
}

function buildUploader() {
  const root = document.createElement('div');
  root.className = 'admin-device-uploader';
  root.dataset.ready = 'checking';
  root.innerHTML = `
    <input class="admin-upload-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden>
    <div class="admin-upload-visual" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 15v4h14v-4"/></svg>
    </div>
    <div class="admin-upload-copy">
      <b>رفع صورة من الجهاز</b>
      <span>اسحب الصورة هنا أو اخترها من الكمبيوتر</span>
      <small>JPG, PNG, WEBP, GIF, AVIF • الحد الأقصى 10 MB • تُرفع مباشرة إلى Google Drive</small>
      <div class="admin-upload-status" data-state="uploading">جاري فحص اتصال Google Drive...</div>
      <div class="admin-upload-progress"><i></i></div>
    </div>
    <button type="button" class="admin-upload-button" disabled>اختيار صورة</button>
  `;

  const input = root.querySelector('.admin-upload-input');
  const button = root.querySelector('.admin-upload-button');

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const [file] = input.files || [];
    uploadFile(file, root);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    root.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (root.dataset.ready === 'true') root.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    root.addEventListener(eventName, (event) => {
      event.preventDefault();
      root.classList.remove('dragging');
    });
  });
  root.addEventListener('drop', (event) => {
    const [file] = event.dataTransfer?.files || [];
    uploadFile(file, root);
  });

  checkReadiness(root);
  return root;
}

function enhanceAdminMediaEditor() {
  if (!window.location.pathname.startsWith('/admin')) return;
  document.querySelectorAll('.admin-media-fields').forEach((fields) => {
    if (fields.querySelector('.admin-device-uploader')) return;
    fields.prepend(buildUploader());
  });
}

if (window.location.pathname.startsWith('/admin')) {
  const observer = new MutationObserver(enhanceAdminMediaEditor);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', enhanceAdminMediaEditor);
  enhanceAdminMediaEditor();
}
