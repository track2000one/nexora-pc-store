import React, { useEffect, useMemo, useState } from 'react';
import './admin.css';

const SESSION_KEY = 'nexora_admin_session_v1';

const statusLabels = {
  ACTIVE: 'نشط',
  DRAFT: 'مسودة',
  ARCHIVED: 'مؤرشف'
};

const emptyForm = {
  id: '',
  name: '',
  sku: '',
  categoryId: '',
  badge: '',
  rating: '4.8',
  price: '',
  oldPrice: '',
  stock: '0',
  status: 'ACTIVE',
  featured: true,
  description: '',
  specsText: '',
  imageDriveId: '',
  imageUrl: ''
};

const money = (value) =>
  new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const driveImage = (id) => id ? `https://drive.google.com/uc?export=view&id=${id.trim()}` : '';

function AdminIcon({ name }) {
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></>,
    trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    logout: <><path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4M17 12H9"/></>,
    store: <><path d="M4 10v10h16V10"/><path d="M3 10 5 4h14l2 6"/><path d="M8 20v-6h8v6"/></>,
    key: <><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 1M18 16a7 7 0 0 1-12 2l-2-1"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 5-5 4 4 3-3 4 4"/></>,
    warning: <><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    orders: <><path d="M6 3h12l2 4H4l2-4Z"/><path d="M5 7v14h14V7"/><path d="M9 11h6"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>;
}

function Login({ apiUrl, onLogin }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'تعذر تسجيل الدخول');
      onLogin(payload.token, payload.expiresIn);
    } catch (err) {
      setError(err.message || 'تعذر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-shell" dir="rtl">
      <div className="admin-login-orb orb-one" />
      <div className="admin-login-orb orb-two" />
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-brand-lockup">
          <span className="admin-brand-mark">NX</span>
          <div>
            <b>NEXORA</b>
            <small>ADMIN CONSOLE</small>
          </div>
        </div>

        <div className="admin-login-copy">
          <span>إدارة المتجر</span>
          <h1>لوحة تحكم آمنة<br/>وسريعة.</h1>
          <p>أدخل مفتاح الإدارة الموجود في Railway. لا يتم حفظ المفتاح نفسه داخل الواجهة أو GitHub.</p>
        </div>

        <label className="admin-field admin-login-field">
          <span>مفتاح الإدارة</span>
          <div className="admin-input-icon">
            <AdminIcon name="key"/>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ADMIN_API_KEY"
              autoComplete="current-password"
              required
            />
          </div>
        </label>

        {error && <div className="admin-alert error">{error}</div>}

        <button className="admin-primary wide" disabled={busy || !key.trim()}>
          {busy ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
        </button>

        <div className="admin-login-security">
          <span className="security-dot"/>
          جلسة مشفّرة مؤقتة لمدة 8 ساعات
        </div>
      </form>
    </div>
  );
}

function StatCard({ label, value, note, tone = 'cyan', icon = 'box' }) {
  return (
    <article className={`admin-stat tone-${tone}`}>
      <div className="admin-stat-icon"><AdminIcon name={icon}/></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function ProductForm({ product, categories, busy, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    if (!product) return { ...emptyForm, categoryId: categories[0]?.id || '' };
    return {
      id: product.id,
      name: product.name || '',
      sku: product.sku || '',
      categoryId: product.categoryId || product.category?.id || '',
      badge: product.badge || '',
      rating: String(product.rating ?? 0),
      price: String(product.price ?? ''),
      oldPrice: product.oldPrice == null ? '' : String(product.oldPrice),
      stock: String(product.stock ?? 0),
      status: product.status || 'ACTIVE',
      featured: Boolean(product.featured),
      description: product.description || '',
      specsText: Array.isArray(product.specs) ? product.specs.join('\n') : '',
      imageDriveId: product.imageDriveId || '',
      imageUrl: product.imageUrl || ''
    };
  });

  const previewUrl = form.imageUrl.trim() || driveImage(form.imageDriveId);

  function patch(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const specs = form.specsText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    onSave({
      id: form.id || undefined,
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: form.categoryId,
      badge: form.badge.trim() || null,
      rating: Number(form.rating || 0),
      price: Number(form.price || 0),
      oldPrice: form.oldPrice === '' ? null : Number(form.oldPrice),
      stock: Number(form.stock || 0),
      status: form.status,
      featured: Boolean(form.featured),
      description: form.description.trim() || null,
      specs,
      currency: 'SAR',
      imageDriveId: form.imageDriveId.trim() || null,
      imageUrl: previewUrl || null
    });
  }

  return (
    <div className="admin-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="admin-drawer" onSubmit={submit} dir="rtl">
        <div className="admin-drawer-head">
          <div>
            <span>{product ? 'تعديل المنتج' : 'منتج جديد'}</span>
            <h2>{product ? product.name : 'إضافة منتج للمتجر'}</h2>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose}><AdminIcon name="close"/></button>
        </div>

        <div className="admin-form-scroll">
          <section className="admin-form-section">
            <div className="admin-form-section-title">
              <b>المعلومات الأساسية</b>
              <small>الاسم، الرمز، التصنيف وحالة الظهور</small>
            </div>
            <div className="admin-form-grid">
              <label className="admin-field span-2">
                <span>اسم المنتج *</span>
                <input value={form.name} onChange={(e) => patch('name', e.target.value)} required placeholder="مثال: AURORA RTX 5070 Ti"/>
              </label>
              <label className="admin-field">
                <span>SKU *</span>
                <input value={form.sku} onChange={(e) => patch('sku', e.target.value)} required placeholder="NX-GPU-5070TI"/>
              </label>
              <label className="admin-field">
                <span>التصنيف *</span>
                <select value={form.categoryId} onChange={(e) => patch('categoryId', e.target.value)} required>
                  <option value="">اختر التصنيف</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>شارة المنتج</span>
                <input value={form.badge} onChange={(e) => patch('badge', e.target.value)} placeholder="NEW / BEST SELLER"/>
              </label>
              <label className="admin-field">
                <span>الحالة</span>
                <select value={form.status} onChange={(e) => patch('status', e.target.value)}>
                  <option value="ACTIVE">نشط</option>
                  <option value="DRAFT">مسودة</option>
                  <option value="ARCHIVED">مؤرشف</option>
                </select>
              </label>
              <label className="admin-toggle-row span-2">
                <input type="checkbox" checked={form.featured} onChange={(e) => patch('featured', e.target.checked)}/>
                <span className="admin-toggle-track"><i/></span>
                <span><b>منتج مميز</b><small>يظهر ضمن مختارات المنصة الرئيسية</small></span>
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section-title">
              <b>السعر والمخزون</b>
              <small>جميع الأسعار بالريال السعودي</small>
            </div>
            <div className="admin-form-grid three">
              <label className="admin-field">
                <span>السعر الحالي *</span>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => patch('price', e.target.value)} required/>
              </label>
              <label className="admin-field">
                <span>السعر السابق</span>
                <input type="number" min="0" step="0.01" value={form.oldPrice} onChange={(e) => patch('oldPrice', e.target.value)}/>
              </label>
              <label className="admin-field">
                <span>الكمية بالمخزون</span>
                <input type="number" min="0" step="1" value={form.stock} onChange={(e) => patch('stock', e.target.value)}/>
              </label>
              <label className="admin-field">
                <span>التقييم</span>
                <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => patch('rating', e.target.value)}/>
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section-title">
              <b>صورة Google Drive</b>
              <small>ارفع الصورة إلى Drive ثم الصق File ID أو الرابط المباشر</small>
            </div>
            <div className="admin-media-editor">
              <div className="admin-image-preview">
                {previewUrl ? <img src={previewUrl} alt="معاينة المنتج"/> : <div><AdminIcon name="image"/><span>لا توجد صورة</span></div>}
              </div>
              <div className="admin-media-fields">
                <label className="admin-field">
                  <span>Google Drive File ID</span>
                  <input value={form.imageDriveId} onChange={(e) => patch('imageDriveId', e.target.value)} placeholder="1AbCdEf..."/>
                </label>
                <label className="admin-field">
                  <span>رابط صورة مباشر — اختياري</span>
                  <input value={form.imageUrl} onChange={(e) => patch('imageUrl', e.target.value)} placeholder="https://..."/>
                </label>
                <small className="admin-field-hint">إذا أضفت File ID فقط، سيتم إنشاء رابط العرض تلقائيًا.</small>
              </div>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-section-title">
              <b>الوصف والمواصفات</b>
              <small>ضع كل مواصفة في سطر مستقل</small>
            </div>
            <div className="admin-form-grid">
              <label className="admin-field span-2">
                <span>وصف المنتج</span>
                <textarea rows="3" value={form.description} onChange={(e) => patch('description', e.target.value)} placeholder="وصف مختصر وواضح للمنتج"/>
              </label>
              <label className="admin-field span-2">
                <span>المواصفات</span>
                <textarea rows="5" value={form.specsText} onChange={(e) => patch('specsText', e.target.value)} placeholder={'16GB GDDR7\nDLSS 4\nRay Tracing\nOC Edition'}/>
              </label>
            </div>
          </section>
        </div>

        <div className="admin-drawer-footer">
          <button type="button" className="admin-secondary" onClick={onClose}>إلغاء</button>
          <button className="admin-primary" disabled={busy}>{busy ? 'جاري الحفظ...' : product ? 'حفظ التعديلات' : 'إضافة المنتج'}</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({ product, busy, onCancel, onConfirm }) {
  if (!product) return null;
  return (
    <div className="admin-confirm-backdrop">
      <div className="admin-confirm" dir="rtl">
        <span className="admin-confirm-icon"><AdminIcon name="warning"/></span>
        <h3>أرشفة المنتج؟</h3>
        <p>سيختفي <b>{product.name}</b> من المتجر، مع الاحتفاظ ببياناته في قاعدة البيانات ويمكن استعادته لاحقًا.</p>
        <div>
          <button className="admin-secondary" onClick={onCancel} disabled={busy}>إلغاء</button>
          <button className="admin-danger" onClick={onConfirm} disabled={busy}>{busy ? 'جاري الأرشفة...' : 'أرشفة المنتج'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp({ apiUrl }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [activeView, setActiveView] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmProduct, setConfirmProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toast, setToast] = useState(null);
  const [backendState, setBackendState] = useState('checking');

  function notify(message, type = 'success') {
    setToast({ message, type });
    window.clearTimeout(window.__nexoraAdminToast);
    window.__nexoraAdminToast = window.setTimeout(() => setToast(null), 3200);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setToken('');
    setOverview(null);
    setProducts([]);
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      logout();
      throw new Error('انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.');
    }
    if (!response.ok) {
      const detail = Array.isArray(payload.details) && payload.details[0]?.message ? ` — ${payload.details[0].message}` : '';
      throw new Error((payload.error || 'تعذر تنفيذ العملية') + detail);
    }
    return payload;
  }

  async function loadData(silent = false) {
    if (!token) return;
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [overviewPayload, productsPayload, categoriesResponse] = await Promise.all([
        api('/api/admin/overview'),
        api('/api/admin/products'),
        fetch(`${apiUrl}/api/categories`).then((r) => r.json())
      ]);
      setOverview(overviewPayload.data);
      setProducts(productsPayload.data || []);
      setCategories(categoriesResponse.data || []);
      setBackendState('online');
    } catch (error) {
      setBackendState('error');
      notify(error.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    api('/api/admin/session')
      .then(() => loadData())
      .catch((error) => notify(error.message, 'error'));
  }, [token]);

  function handleLogin(newToken) {
    sessionStorage.setItem(SESSION_KEY, newToken);
    setToken(newToken);
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesStatus = statusFilter === 'ALL' || product.status === statusFilter;
      const matchesSearch = !query ||
        product.name?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.category?.name?.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [products, search, statusFilter]);

  async function saveProduct(data) {
    setSaving(true);
    try {
      const isEdit = Boolean(data.id);
      const id = data.id;
      const body = { ...data };
      delete body.id;

      await api(isEdit ? `/api/products/${id}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });

      setEditorOpen(false);
      setEditor(null);
      notify(isEdit ? 'تم تحديث المنتج بنجاح' : 'تمت إضافة المنتج بنجاح');
      await loadData(true);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct() {
    if (!confirmProduct) return;
    setSaving(true);
    try {
      await api(`/api/products/${confirmProduct.id}`, { method: 'DELETE' });
      notify('تمت أرشفة المنتج');
      setConfirmProduct(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditor(null);
    setEditorOpen(true);
  }

  function openEdit(product) {
    setEditor(product);
    setEditorOpen(true);
  }

  if (!token) return <Login apiUrl={apiUrl} onLogin={handleLogin}/>;

  const activeProducts = overview?.activeProducts ?? 0;
  const totalStock = overview?.totalStock ?? 0;

  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span>NX</span>
          <div><b>NEXORA</b><small>ADMIN CONSOLE</small></div>
        </div>

        <nav className="admin-side-nav">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => setActiveView('overview')}>
            <AdminIcon name="grid"/><span>نظرة عامة</span>
          </button>
          <button className={activeView === 'products' ? 'active' : ''} onClick={() => setActiveView('products')}>
            <AdminIcon name="box"/><span>المنتجات</span><em>{products.length}</em>
          </button>
          <button disabled title="سيتم تفعيله في المرحلة التالية">
            <AdminIcon name="orders"/><span>الطلبات</span><i>قريبًا</i>
          </button>
        </nav>

        <div className="admin-sidebar-bottom">
          <a href="/" className="admin-store-link"><AdminIcon name="store"/><span>عرض المتجر</span></a>
          <button onClick={logout}><AdminIcon name="logout"/><span>تسجيل الخروج</span></button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">NEXORA MANAGEMENT</span>
            <h1>{activeView === 'overview' ? 'لوحة التحكم' : 'إدارة المنتجات'}</h1>
          </div>
          <div className="admin-top-actions">
            <span className={`admin-backend-state ${backendState}`}>
              <i/>{backendState === 'online' ? 'API متصل' : backendState === 'error' ? 'مشكلة اتصال' : 'فحص الاتصال'}
            </span>
            <button className="admin-icon-button" onClick={() => loadData(true)} disabled={refreshing} title="تحديث البيانات">
              <AdminIcon name="refresh"/>
            </button>
            <button className="admin-primary" onClick={openCreate}><AdminIcon name="plus"/>إضافة منتج</button>
          </div>
        </header>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-loader"/>
            <b>جاري تحميل بيانات المتجر...</b>
            <span>Railway API + PostgreSQL</span>
          </div>
        ) : (
          <>
            <section className="admin-stats-grid">
              <StatCard label="المنتجات النشطة" value={activeProducts} note="متاحة للعملاء الآن" tone="cyan" icon="box"/>
              <StatCard label="إجمالي المخزون" value={totalStock} note="وحدة متاحة" tone="blue" icon="grid"/>
              <StatCard label="مخزون منخفض" value={overview?.lowStock ?? 0} note="5 وحدات أو أقل" tone="orange" icon="warning"/>
              <StatCard label="التصنيفات" value={overview?.categories ?? 0} note="تصنيفات المتجر" tone="violet" icon="grid"/>
            </section>

            {activeView === 'overview' && (
              <section className="admin-overview-grid">
                <article className="admin-panel admin-inventory-panel">
                  <div className="admin-panel-head">
                    <div><span>المخزون</span><h2>حالة المنتجات</h2></div>
                    <button onClick={() => setActiveView('products')}>إدارة الكل</button>
                  </div>
                  <div className="admin-status-bars">
                    <div>
                      <span><b>نشط</b><em>{overview?.activeProducts ?? 0}</em></span>
                      <i><u style={{ width: `${Math.min(100, ((overview?.activeProducts || 0) / Math.max(1, products.length)) * 100)}%` }}/></i>
                    </div>
                    <div>
                      <span><b>مسودة</b><em>{overview?.draftProducts ?? 0}</em></span>
                      <i><u style={{ width: `${Math.min(100, ((overview?.draftProducts || 0) / Math.max(1, products.length)) * 100)}%` }}/></i>
                    </div>
                    <div>
                      <span><b>مؤرشف</b><em>{overview?.archivedProducts ?? 0}</em></span>
                      <i><u style={{ width: `${Math.min(100, ((overview?.archivedProducts || 0) / Math.max(1, products.length)) * 100)}%` }}/></i>
                    </div>
                  </div>
                </article>

                <article className="admin-panel admin-recent-panel">
                  <div className="admin-panel-head"><div><span>آخر تحديثات</span><h2>المنتجات</h2></div></div>
                  <div className="admin-recent-list">
                    {products.slice(0, 4).map((product) => (
                      <button key={product.id} onClick={() => openEdit(product)}>
                        <span className="admin-mini-image">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <AdminIcon name="image"/>}</span>
                        <span><b>{product.name}</b><small>{product.category?.name} • {product.sku}</small></span>
                        <em>{money(product.price)}</em>
                      </button>
                    ))}
                  </div>
                </article>
              </section>
            )}

            {activeView === 'products' && (
              <section className="admin-products-panel admin-panel">
                <div className="admin-products-toolbar">
                  <div className="admin-search">
                    <AdminIcon name="search"/>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو SKU أو التصنيف..."/>
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="ALL">كل الحالات</option>
                    <option value="ACTIVE">نشط</option>
                    <option value="DRAFT">مسودة</option>
                    <option value="ARCHIVED">مؤرشف</option>
                  </select>
                  <span className="admin-result-count">{filteredProducts.length} منتج</span>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-products-table">
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>التصنيف</th>
                        <th>السعر</th>
                        <th>المخزون</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className="admin-product-cell">
                              <span className="admin-product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <AdminIcon name="image"/>}</span>
                              <span><b>{product.name}</b><small>{product.sku}{product.featured ? ' • مميز' : ''}</small></span>
                            </div>
                          </td>
                          <td>{product.category?.name || '—'}</td>
                          <td><b className="admin-price">{money(product.price)}</b>{product.oldPrice != null && <small className="admin-old-price">{money(product.oldPrice)}</small>}</td>
                          <td><span className={`admin-stock ${product.stock <= 5 ? 'low' : ''}`}>{product.stock}</span></td>
                          <td><span className={`admin-status status-${product.status?.toLowerCase()}`}>{statusLabels[product.status] || product.status}</span></td>
                          <td>
                            <div className="admin-row-actions">
                              <button onClick={() => openEdit(product)} title="تعديل"><AdminIcon name="edit"/></button>
                              {product.status !== 'ARCHIVED' && <button className="danger" onClick={() => setConfirmProduct(product)} title="أرشفة"><AdminIcon name="trash"/></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredProducts.length && (
                        <tr><td colSpan="6"><div className="admin-empty"><AdminIcon name="box"/><b>لا توجد منتجات مطابقة</b><span>غيّر البحث أو الفلتر أو أضف منتجًا جديدًا.</span></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {editorOpen && <ProductForm product={editor} categories={categories} busy={saving} onClose={() => { setEditorOpen(false); setEditor(null); }} onSave={saveProduct}/>} 
      <ConfirmDialog product={confirmProduct} busy={saving} onCancel={() => setConfirmProduct(null)} onConfirm={archiveProduct}/>
      {toast && <div className={`admin-toast ${toast.type}`}><AdminIcon name={toast.type === 'error' ? 'warning' : 'check'}/><span>{toast.message}</span></div>}
    </div>
  );
}
