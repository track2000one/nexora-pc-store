import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { products as fallbackProducts } from './data';
import AdminApp from './admin.jsx';
import './adminUploadEnhancer.js';
import './styles.css';
import './productGallery.css';

const themes = ['ocean', 'ruby', 'mint'];
const API_URL = import.meta.env.VITE_API_URL || 'https://nexora-backend-production-4e78.up.railway.app';

const categoryKeyMap = {
  parts: 'parts',
  monitors: 'monitor',
  accessories: 'gear'
};

const money = (value) => new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0
}).format(Number(value || 0));

function normalizeProduct(product) {
  const gallery = Array.isArray(product.images) && product.images.length
    ? product.images.map((image, index) => ({
        id: image.id || `${product.id}-${index}`,
        url: image.url || image.imageUrl,
        altText: image.altText || product.name,
        isPrimary: Boolean(image.isPrimary),
        sortOrder: Number(image.sortOrder ?? index)
      })).filter((image) => image.url)
    : product.imageUrl
      ? [{ id: `${product.id}-main`, url: product.imageUrl, altText: product.name, isPrimary: true, sortOrder: 0 }]
      : [];

  gallery.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  return {
    id: product.id,
    title: product.name,
    category: product.category?.name || 'منتج',
    categoryKey: categoryKeyMap[product.category?.slug] || 'parts',
    badge: product.badge || 'NEW',
    rating: Number(product.rating || 0),
    price: Number(product.price || 0),
    oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
    image: gallery[0]?.url || product.imageUrl,
    images: gallery,
    description: product.description || '',
    specs: Array.isArray(product.specs) ? product.specs : [],
    stock: Number(product.stock || 0),
    currency: product.currency || 'SAR'
  };
}

function Icon({ name }) {
  const paths = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    cart: <><path d="M3 4h2l2.1 9.1a2 2 0 0 0 2 1.5h7.7a2 2 0 0 0 2-1.6L20 7H6"/><circle cx="10" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/></>,
    palette: <><path d="M12 3c-5 0-9 3.6-9 8 0 4 3.3 7 7.3 7H12a1.5 1.5 0 0 0 0-3h-.7c-.8 0-1.3-.7-1.3-1.4 0-.8.6-1.5 1.4-1.5h4.1A5.5 5.5 0 0 0 21 6.7C19.4 4.4 15.8 3 12 3Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="11" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/></>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    zoom: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/></>,
    chevronLeft: <path d="m15 18-6-6 6-6"/>,
    chevronRight: <path d="m9 18 6-6-6-6"/>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function ProductCard({ product, onAdd, onPreview }) {
  const [fav, setFav] = useState(false);
  const [mouse, setMouse] = useState({ x: '50%', y: '20%' });

  return (
    <article
      className={`product-card category-${product.categoryKey}`}
      style={{ '--mx': mouse.x, '--my': mouse.y }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({ x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` });
      }}
      onMouseLeave={() => setMouse({ x: '50%', y: '20%' })}
    >
      <div className="glass-edge edge-one" />
      <div className="glass-edge edge-two" />
      <div className="glare" />
      <button className={`top-icon ${fav ? 'active' : ''}`} onClick={() => setFav(v => !v)} aria-label="المفضلة"><Icon name="heart"/></button>
      <span className="badge">{product.badge}</span>

      <div className="product-stage">
        <img src={product.image} alt={product.title} onError={(e) => { e.currentTarget.style.opacity = .22; }} />
        <span className="neon-line" />
      </div>

      <div className="meta-row">
        <span className="category-pill"><i />{product.category}</span>
        <span className="rating">★ {product.rating}</span>
      </div>

      <h3>{product.title}</h3>
      <p className="specs">{product.specs.slice(0, 2).join(' • ')}<br/>{product.specs.slice(2).join(' • ')}</p>
      <div className="divider" />

      <div className="bottom-row">
        <div className="actions">
          <button onClick={() => onAdd(product)} aria-label="إضافة للسلة"><Icon name="cart"/></button>
          <button onClick={() => onPreview(product)} aria-label="عرض المنتج"><Icon name="eye"/></button>
        </div>
        <div className="price-block">
          {product.oldPrice != null && <del>{money(product.oldPrice)}</del>}
          <strong>{money(product.price)}</strong>
        </div>
      </div>
    </article>
  );
}

function ProductViewer({ product, onClose, onAdd }) {
  const gallery = product.images?.length
    ? product.images
    : product.image
      ? [{ id: 'main', url: product.image, altText: product.title, isPrimary: true }]
      : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const active = gallery[activeIndex] || gallery[0];

  useEffect(() => {
    setActiveIndex(0);
    setZoomed(false);
  }, [product.id]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') zoomed ? setZoomed(false) : onClose();
      if (event.key === 'ArrowLeft' && gallery.length > 1) setActiveIndex((index) => (index + 1) % gallery.length);
      if (event.key === 'ArrowRight' && gallery.length > 1) setActiveIndex((index) => (index - 1 + gallery.length) % gallery.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gallery.length, onClose, zoomed]);

  const move = (direction) => {
    if (!gallery.length) return;
    setActiveIndex((index) => (index + direction + gallery.length) % gallery.length);
  };

  return (
    <div className="product-viewer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} dir="rtl">
      <article className="product-viewer-shell">
        <button className="product-viewer-close" onClick={onClose} aria-label="إغلاق"><Icon name="close"/></button>

        <section className="product-viewer-media">
          <div className="product-viewer-main">
            {active ? (
              <button className="product-viewer-image-button" onClick={() => setZoomed(true)} title="تكبير الصورة">
                <img key={active.id} src={active.url} alt={active.altText || product.title}/>
                <span className="product-viewer-zoom"><Icon name="zoom"/> تكبير</span>
              </button>
            ) : <div className="product-viewer-no-image">لا توجد صورة</div>}
            {gallery.length > 1 && <>
              <button className="gallery-nav gallery-nav-prev" onClick={() => move(-1)}><Icon name="chevronRight"/></button>
              <button className="gallery-nav gallery-nav-next" onClick={() => move(1)}><Icon name="chevronLeft"/></button>
            </>}
          </div>

          {gallery.length > 1 && (
            <div className="product-thumbnails" role="list" aria-label="صور المنتج">
              {gallery.map((image, index) => (
                <button
                  key={image.id}
                  className={`product-thumbnail ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`عرض الصورة ${index + 1}`}
                >
                  <img src={image.url} alt={image.altText || `${product.title} - ${index + 1}`}/>
                  {image.isPrimary && <span>رئيسية</span>}
                </button>
              ))}
            </div>
          )}
          <small className="gallery-counter">{gallery.length ? `${activeIndex + 1} / ${gallery.length}` : '0 / 0'}</small>
        </section>

        <section className="product-viewer-info">
          <div className="viewer-meta"><span>{product.category}</span><b>★ {product.rating}</b></div>
          <h2>{product.title}</h2>
          {product.description && <p className="viewer-description">{product.description}</p>}
          {product.specs.length > 0 && <div className="viewer-specs">{product.specs.map((spec) => <span key={spec}>{spec}</span>)}</div>}
          <div className="viewer-stock"><i className={product.stock > 0 ? 'available' : ''}/>{product.stock > 0 ? `متوفر في المخزون • ${product.stock}` : 'غير متوفر حاليًا'}</div>
          <div className="viewer-purchase">
            <div>{product.oldPrice != null && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong></div>
            <button disabled={product.stock <= 0} onClick={() => onAdd(product)}><Icon name="cart"/> إضافة للسلة</button>
          </div>
        </section>
      </article>

      {zoomed && active && (
        <div className="product-lightbox" onMouseDown={(event) => event.target === event.currentTarget && setZoomed(false)}>
          <button className="lightbox-close" onClick={() => setZoomed(false)}><Icon name="close"/></button>
          <img src={active.url} alt={active.altText || product.title}/>
          {gallery.length > 1 && <>
            <button className="lightbox-nav lightbox-prev" onClick={() => move(-1)}><Icon name="chevronRight"/></button>
            <button className="lightbox-nav lightbox-next" onClick={() => move(1)}><Icon name="chevronLeft"/></button>
          </>}
          <span>{activeIndex + 1} / {gallery.length}</span>
        </div>
      )}
    </div>
  );
}

function Storefront() {
  const [themeIndex, setThemeIndex] = useState(0);
  const [cart, setCart] = useState([]);
  const [preview, setPreview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('connecting');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/products`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const liveProducts = Array.isArray(payload.data) ? payload.data.map(normalizeProduct) : [];
        setProducts(liveProducts.length ? liveProducts : fallbackProducts);
        setApiStatus(liveProducts.length ? 'online' : 'empty');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load products from API:', error);
          setProducts(fallbackProducts);
          setApiStatus('fallback');
        }
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, []);

  const theme = themes[themeIndex];
  const cartTotal = useMemo(() => cart.reduce((sum, product) => sum + Number(product.price || 0), 0), [cart]);

  return <div className={`app theme-${theme}`}>
    <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header>
      <div className="brand"><span className="logo">NX</span><div><b>NEXORA</b><small>PC STORE</small></div></div>
      <nav><a href="#products">المنتجات</a><a href="#categories">التصنيفات</a><a href="#offers">العروض</a></nav>
      <div className="header-actions">
        <button className="theme-btn" onClick={() => setThemeIndex((themeIndex + 1) % themes.length)} title="تغيير الثيم"><Icon name="palette"/></button>
        <button className="cart-chip"><Icon name="cart"/><span>{cart.length}</span></button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">NEXT-GEN PC STORE</span><h1>تقنية أقوى.<br/><em>تجربة أفخم.</em></h1><p>متجر أجهزة وملحقات بتجربة زجاجية مستقبلية متصل مباشرة بقاعدة بيانات PostgreSQL عبر NEXORA API.</p></div>
        <div className="hero-stat"><b>{money(cartTotal)}</b><span>قيمة السلة</span></div>
      </section>

      <section className="products" id="products">
        <div className="section-title">
          <div><span>مختاراتنا</span><h2>منتجات مميزة</h2></div>
          <p>{apiStatus === 'online' ? 'Live • Railway API + PostgreSQL' : apiStatus === 'empty' ? 'قاعدة البيانات جاهزة — يتم تجهيز المنتجات' : apiStatus === 'fallback' ? 'وضع احتياطي مؤقت' : 'جاري الاتصال بالـ API...'}</p>
        </div>
        <div className="card-grid">
          {loading ? <p>جاري تحميل المنتجات...</p> : products.map(p => <ProductCard key={p.id} product={p} onAdd={(x) => setCart(c => [...c, x])} onPreview={setPreview}/>) }
        </div>
      </section>
    </main>

    {preview && <ProductViewer product={preview} onClose={() => setPreview(null)} onAdd={(x) => setCart((cartItems) => [...cartItems, x])}/>} 
  </div>;
}

const root = createRoot(document.getElementById('root'));
const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
root.render(isAdmin ? <AdminApp apiUrl={API_URL}/> : <Storefront/>);