import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { products } from './data';
import './styles.css';

const themes = ['ocean', 'ruby', 'mint'];

function Icon({name}) {
  const paths = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    cart: <><path d="M3 4h2l2.1 9.1a2 2 0 0 0 2 1.5h7.7a2 2 0 0 0 2-1.6L20 7H6"/><circle cx="10" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/></>,
    palette: <><path d="M12 3c-5 0-9 3.6-9 8 0 4 3.3 7 7.3 7H12a1.5 1.5 0 0 0 0-3h-.7c-.8 0-1.3-.7-1.3-1.4 0-.8.6-1.5 1.4-1.5h4.1A5.5 5.5 0 0 0 21 6.7C19.4 4.4 15.8 3 12 3Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="11" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function ProductCard({product, onAdd, onPreview}) {
  const [fav, setFav] = useState(false);
  const [mouse, setMouse] = useState({x: '50%', y: '20%'});
  return (
    <article
      className={`product-card category-${product.categoryKey}`}
      style={{'--mx': mouse.x, '--my': mouse.y}}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({x: `${e.clientX-r.left}px`, y: `${e.clientY-r.top}px`});
      }}
      onMouseLeave={() => setMouse({x:'50%',y:'20%'})}
    >
      <div className="glass-edge edge-one" />
      <div className="glass-edge edge-two" />
      <div className="glare" />
      <button className={`top-icon ${fav ? 'active' : ''}`} onClick={() => setFav(v => !v)} aria-label="المفضلة"><Icon name="heart"/></button>
      <span className="badge">{product.badge}</span>

      <div className="product-stage">
        <img src={product.image} alt={product.title} onError={(e)=>{e.currentTarget.style.opacity=.22}} />
        <span className="neon-line" />
      </div>

      <div className="meta-row">
        <span className="category-pill"><i />{product.category}</span>
        <span className="rating">★ {product.rating}</span>
      </div>

      <h3>{product.title}</h3>
      <p className="specs">{product.specs.slice(0,2).join(' • ')}<br/>{product.specs.slice(2).join(' • ')}</p>
      <div className="divider" />

      <div className="bottom-row">
        <div className="actions">
          <button onClick={()=>onAdd(product)} aria-label="إضافة للسلة"><Icon name="cart"/></button>
          <button onClick={()=>onPreview(product)} aria-label="معاينة"><Icon name="eye"/></button>
        </div>
        <div className="price-block">
          <del>${product.oldPrice.toFixed(2)}</del>
          <strong>${product.price.toFixed(2)}</strong>
        </div>
      </div>
    </article>
  );
}

function App(){
  const [themeIndex,setThemeIndex] = useState(0);
  const [cart,setCart] = useState([]);
  const [preview,setPreview] = useState(null);
  const theme = themes[themeIndex];
  const cartTotal = useMemo(()=>cart.reduce((s,p)=>s+p.price,0),[cart]);

  return <div className={`app theme-${theme}`}>
    <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header>
      <div className="brand"><span className="logo">NX</span><div><b>NEXORA</b><small>PC STORE</small></div></div>
      <nav><a href="#products">المنتجات</a><a href="#categories">التصنيفات</a><a href="#offers">العروض</a></nav>
      <div className="header-actions">
        <button className="theme-btn" onClick={()=>setThemeIndex((themeIndex+1)%themes.length)} title="تغيير الثيم"><Icon name="palette"/></button>
        <button className="cart-chip"><Icon name="cart"/><span>{cart.length}</span></button>
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">NEXT-GEN PC STORE</span><h1>تقنية أقوى.<br/><em>تجربة أفخم.</em></h1><p>متجر أجهزة وملحقات بتجربة زجاجية مستقبلية مصممة للعرض التجاري الاحترافي.</p></div>
        <div className="hero-stat"><b>${cartTotal.toFixed(2)}</b><span>قيمة السلة</span></div>
      </section>

      <section className="products" id="products">
        <div className="section-title"><div><span>مختاراتنا</span><h2>منتجات مميزة</h2></div><p>صور المنتجات مرتبطة بـ Google Drive</p></div>
        <div className="card-grid">
          {products.map(p => <ProductCard key={p.id} product={p} onAdd={(x)=>setCart(c=>[...c,x])} onPreview={setPreview}/>) }
        </div>
      </section>
    </main>

    {preview && <div className="modal" onClick={()=>setPreview(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}><img src={preview.image} alt=""/><div><span>{preview.category}</span><h2>{preview.title}</h2><p>{preview.specs.join(' • ')}</p><strong>${preview.price.toFixed(2)}</strong><button onClick={()=>setPreview(null)}>إغلاق</button></div></div></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
