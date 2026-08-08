import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { products as fallbackProducts } from './data';
import AdminApp from './admin.jsx';
import './styles.css';

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
  return {
    id: product.id,
    title: product.name,
    category: product.category?.name || 'منتج',
    categoryKey: categoryKeyMap[product.category?.slug] || 'parts',
    badge: product.badge || 'NEW',
    rating: Number(product.rating || 0),
    price: Number(product.price || 0),
    oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
    image: product.imageUrl,
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
    palette: <><path d="M12 3c-5 0-9 3.6-9 8 0 4 3.3 7 7.3 7H12a1.5 1.5 0 0 0 0-3h-.7c-.8 0-1.3-.7-1.3-1.4 0-.8.6-1.5 1.4-1.5h4.1A5.5 5.5 0 0 0 21 6.7C19.4 4.4 15.8 3 12 3Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="11" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/></>
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
          <button onClick={() => onPreview(product)} aria-label="معاينة"><Icon name="eye"/></button>
        </div>
        <div className="price-block">
          {product.oldPrice != null && <del>{money(product.oldPrice)}</del>}
          <strong>{money(product.price)}</strong>
        </div>
      </div>
    </article>
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

    {preview && <div className="modal" onClick={() => setPreview(null)}><div className="modal-card" onClick={e => e.stopPropagation()}><img src={preview.image} alt=""/><div><span>{preview.category}</span><h2>{preview.title}</h2><p>{preview.specs.join(' • ')}</p><strong>{money(preview.price)}</strong><button onClick={() => setPreview(null)}>إغلاق</button></div></div></div>}
  </div>;
}

const root = createRoot(document.getElementById('root'));
const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
root.render(isAdmin ? <AdminApp apiUrl={API_URL}/> : <Storefront/>);
