import React, { useEffect, useMemo, useRef, useState } from 'react';
import './account.css';

const STORAGE_TOKEN = 'nexora_customer_token';
const STORAGE_USER = 'nexora_customer_user';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function SvgIcon({ name }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>,
    phone: <><path d="M7.2 3.5 10 7.2 8.1 9.5c1 2.5 3 4.5 5.4 5.5l2.4-1.9 3.6 2.9c.6.5.7 1.4.3 2.1-.8 1.3-2.3 2.2-3.9 2.2C9.2 20.3 3.7 14.8 3.7 8.1c0-1.6.8-3.1 2.2-3.9.5-.3 1-.2 1.3.3Z"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18"/><path d="M10.6 5.2C11.1 5.1 11.5 5 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 4.1M6.2 6.2C3.4 8.1 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2"/></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    back: <path d="m15 18-6-6 6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <path d="M12 3 5 6v5c0 4.4 2.8 8.2 7 10 4.2-1.8 7-5.6 7-10V6l-7-3Z"/>,
    spark: <><path d="M12 2 9.8 8.2 4 10.4l5.8 2.1L12 19l2.2-6.5 5.8-2.1-5.8-2.2L12 2Z"/><path d="m19 17 .8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></>,
    logout: <><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M9 12h9"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function GoogleGlyph() {
  return <svg className="google-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"/>
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/>
    <path fill="#FBBC05" d="M6.5 14.1A6 6 0 0 1 6.2 12c0-.7.1-1.4.3-2.1V7.3H3.2A10 10 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7l3.3-2.6Z"/>
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.8 5.3l3.3 2.6a5.8 5.8 0 0 1 5.5-4Z"/>
  </svg>;
}

function Field({ icon, label, type = 'text', value, onChange, placeholder, autoComplete, inputMode, error, trailing }) {
  return <label className={`account-field ${error ? 'has-error' : ''}`}>
    <span className="account-field-label">{label}</span>
    <div className="account-input-shell">
      <span className="account-input-icon"><SvgIcon name={icon}/></span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
      {trailing}
    </div>
    {error && <small>{error}</small>}
  </label>;
}

function passwordStrength(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[A-Za-z\u0600-\u06FF]/.test(value)) score += 1;
  if (/[^A-Za-z0-9\u0600-\u06FF]/.test(value)) score += 1;
  return score;
}

function saveSession(data, remember = true) {
  const storage = remember ? localStorage : sessionStorage;
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USER);
  sessionStorage.removeItem(STORAGE_TOKEN);
  sessionStorage.removeItem(STORAGE_USER);
  storage.setItem(STORAGE_TOKEN, data.token);
  storage.setItem(STORAGE_USER, JSON.stringify(data.user));
}

function existingSession() {
  const token = localStorage.getItem(STORAGE_TOKEN) || sessionStorage.getItem(STORAGE_TOKEN);
  const raw = localStorage.getItem(STORAGE_USER) || sessionStorage.getItem(STORAGE_USER);
  try { return token && raw ? { token, user: JSON.parse(raw) } : null; } catch { return null; }
}

async function apiRequest(apiUrl, path, options = {}) {
  const response = await fetch(`${apiUrl}/api/auth${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || 'تعذر إكمال العملية.');
    error.payload = payload;
    throw error;
  }
  return payload;
}

export default function AccountApp({ apiUrl }) {
  const params = new URLSearchParams(window.location.search);
  const initialMode = ['login', 'register', 'forgot'].includes(params.get('mode')) ? params.get('mode') : 'login';
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [currentSession, setCurrentSession] = useState(existingSession);
  const googleRef = useRef(null);

  const [login, setLogin] = useState({ email: '', password: '' });
  const [register, setRegister] = useState({ fullName: '', phone: '', email: '', password: '', confirm: '', terms: false });
  const [forgotEmail, setForgotEmail] = useState('');

  const strength = useMemo(() => passwordStrength(register.password), [register.password]);

  useEffect(() => {
    setMessage(null);
    setShowPassword(false);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    window.history.replaceState({}, '', url);
  }, [mode]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return undefined;
    let cancelled = false;
    const setup = () => {
      if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
      googleRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          if (!credential) return;
          setBusy(true);
          setMessage(null);
          try {
            const payload = await apiRequest(apiUrl, '/google', { method: 'POST', body: JSON.stringify({ credential }) });
            saveSession(payload.data, true);
            setCurrentSession({ token: payload.data.token, user: payload.data.user });
            setMessage({ type: 'success', text: 'تم تسجيل الدخول عبر Google بنجاح.' });
            window.setTimeout(() => { window.location.href = '/'; }, 650);
          } catch (error) {
            setMessage({ type: 'error', text: error.message });
          } finally {
            setBusy(false);
          }
        }
      });
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: 'outline', size: 'large', shape: 'pill', width: 340,
        text: mode === 'register' ? 'signup_with' : 'continue_with', locale: 'ar'
      });
    };

    if (window.google?.accounts?.id) setup();
    else {
      const existing = document.querySelector('script[data-nexora-google]');
      const script = existing || document.createElement('script');
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.nexoraGoogle = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', setup, { once: true });
      return () => { cancelled = true; script.removeEventListener('load', setup); };
    }
    return () => { cancelled = true; };
  }, [apiUrl, mode]);

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const payload = await apiRequest(apiUrl, '/login', { method: 'POST', body: JSON.stringify(login) });
      saveSession(payload.data, remember);
      setCurrentSession({ token: payload.data.token, user: payload.data.user });
      setMessage({ type: 'success', text: `أهلًا ${payload.data.user.fullName}، تم تسجيل الدخول.` });
      window.setTimeout(() => { window.location.href = '/'; }, 650);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setMessage(null);
    if (register.password !== register.confirm) return setMessage({ type: 'error', text: 'كلمتا المرور غير متطابقتين.' });
    if (!register.terms) return setMessage({ type: 'error', text: 'يلزم الموافقة على الشروط وسياسة الخصوصية.' });
    setBusy(true);
    try {
      const payload = await apiRequest(apiUrl, '/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: register.fullName, phone: register.phone, email: register.email, password: register.password })
      });
      saveSession(payload.data, true);
      setCurrentSession({ token: payload.data.token, user: payload.data.user });
      setMessage({ type: 'success', text: 'تم إنشاء حساب NEXORA بنجاح.' });
      window.setTimeout(() => { window.location.href = '/'; }, 700);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  }

  async function submitForgot(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const payload = await apiRequest(apiUrl, '/forgot-password', { method: 'POST', body: JSON.stringify({ email: forgotEmail }) });
      setMessage({ type: 'success', text: payload.data?.message || 'تم تسجيل طلب الاستعادة.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  }

  async function logout() {
    const session = currentSession || existingSession();
    if (session?.token) {
      try { await apiRequest(apiUrl, '/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }); } catch { /* local logout still proceeds */ }
    }
    localStorage.removeItem(STORAGE_TOKEN); localStorage.removeItem(STORAGE_USER);
    sessionStorage.removeItem(STORAGE_TOKEN); sessionStorage.removeItem(STORAGE_USER);
    setCurrentSession(null); setMode('login');
  }

  const labels = {
    login: { kicker: 'مرحبًا بعودتك', title: 'سجّل دخولك إلى NEXORA', desc: 'ادخل إلى طلباتك ومفضلاتك وتجربة شراء أسرع.' },
    register: { kicker: 'حساب جديد', title: 'انضم إلى عالم NEXORA', desc: 'أنشئ حسابك خلال أقل من دقيقة واحفظ بياناتك بأمان.' },
    forgot: { kicker: 'استعادة الحساب', title: 'نسيت كلمة المرور؟', desc: 'أدخل بريدك وسنجهز لك خطوات استعادة الوصول إلى حسابك.' }
  };

  return <main className="account-page" dir="rtl">
    <div className="account-orb account-orb-a"/><div className="account-orb account-orb-b"/>
    <a className="account-back" href="/"><SvgIcon name="back"/> العودة للمتجر</a>

    <section className="account-shell">
      <aside className="account-showcase">
        <div className="account-brand"><span>NX</span><div><b>NEXORA</b><small>PC STORE</small></div></div>
        <div className="account-showcase-copy">
          <span className="account-kicker"><SvgIcon name="spark"/> MEMBER EXPERIENCE</span>
          <h1>تجربة شراء<br/><em>أقرب لك.</em></h1>
          <p>حساب واحد يجمع مشترياتك، مفضلاتك، بيانات الشحن، والعروض المخصصة لك داخل تجربة زجاجية آمنة.</p>
        </div>
        <div className="account-benefits">
          <div><span><SvgIcon name="shield"/></span><div><b>جلسات دخول آمنة</b><small>بيانات حسابك لا تُخزن كنص مكشوف.</small></div></div>
          <div><span><SvgIcon name="spark"/></span><div><b>تجربة أسرع</b><small>احتفظ ببياناتك لتسوق أكثر سلاسة.</small></div></div>
        </div>
        <div className="account-glass-chip"><i/><span>Secure customer account</span><b>256-bit</b></div>
      </aside>

      <section className="account-panel">
        {currentSession ? <div className="account-signed-card">
          <div className="account-avatar">{currentSession.user.avatarUrl ? <img src={currentSession.user.avatarUrl} alt=""/> : currentSession.user.fullName?.slice(0, 1)}</div>
          <span>أنت مسجل الدخول</span>
          <h2>{currentSession.user.fullName}</h2>
          <p>{currentSession.user.email}</p>
          {currentSession.user.phone && <p>{currentSession.user.phone}</p>}
          <div className="account-signed-actions"><a href="/">الذهاب للمتجر <SvgIcon name="arrow"/></a><button onClick={logout}><SvgIcon name="logout"/> تسجيل الخروج</button></div>
        </div> : <>
          <header className="account-panel-head">
            <span>{labels[mode].kicker}</span>
            <h2>{labels[mode].title}</h2>
            <p>{labels[mode].desc}</p>
          </header>

          {mode !== 'forgot' && <div className="account-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>تسجيل الدخول</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>إنشاء حساب</button>
          </div>}

          {message && <div className={`account-message ${message.type}`}><span>{message.type === 'success' ? <SvgIcon name="check"/> : '!'}</span>{message.text}</div>}

          {mode === 'login' && <form className="account-form" onSubmit={submitLogin}>
            <Field icon="mail" label="البريد الإلكتروني" type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} placeholder="name@example.com" autoComplete="email"/>
            <Field icon="lock" label="كلمة المرور" type={showPassword ? 'text' : 'password'} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} placeholder="••••••••" autoComplete="current-password" trailing={<button type="button" className="password-eye" onClick={() => setShowPassword(v => !v)}><SvgIcon name={showPassword ? 'eyeOff' : 'eye'}/></button>}/>
            <div className="account-form-row"><label className="account-checkbox"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}/><span/>تذكرني</label><button type="button" className="text-link" onClick={() => setMode('forgot')}>نسيت كلمة المرور؟</button></div>
            <button className="account-primary" disabled={busy}>{busy ? <i className="account-spinner"/> : <>دخول إلى حسابي <SvgIcon name="arrow"/></>}</button>
          </form>}

          {mode === 'register' && <form className="account-form register-form" onSubmit={submitRegister}>
            <div className="account-two-cols">
              <Field icon="user" label="الاسم الكامل" value={register.fullName} onChange={(e) => setRegister({ ...register, fullName: e.target.value })} placeholder="الاسم كما ترغب ظهوره" autoComplete="name"/>
              <Field icon="phone" label="رقم الجوال" type="tel" value={register.phone} onChange={(e) => setRegister({ ...register, phone: e.target.value })} placeholder="05XXXXXXXX" autoComplete="tel" inputMode="tel"/>
            </div>
            <Field icon="mail" label="البريد الإلكتروني" type="email" value={register.email} onChange={(e) => setRegister({ ...register, email: e.target.value })} placeholder="name@example.com" autoComplete="email"/>
            <div className="account-two-cols">
              <Field icon="lock" label="كلمة المرور" type={showPassword ? 'text' : 'password'} value={register.password} onChange={(e) => setRegister({ ...register, password: e.target.value })} placeholder="8 أحرف على الأقل" autoComplete="new-password" trailing={<button type="button" className="password-eye" onClick={() => setShowPassword(v => !v)}><SvgIcon name={showPassword ? 'eyeOff' : 'eye'}/></button>}/>
              <Field icon="lock" label="تأكيد كلمة المرور" type={showPassword ? 'text' : 'password'} value={register.confirm} onChange={(e) => setRegister({ ...register, confirm: e.target.value })} placeholder="أعد كتابة كلمة المرور" autoComplete="new-password"/>
            </div>
            <div className="password-strength"><div>{[1,2,3,4].map(n => <i key={n} className={strength >= n ? 'on' : ''}/>)}</div><span>{['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'][strength]}</span></div>
            <label className="account-checkbox terms"><input type="checkbox" checked={register.terms} onChange={(e) => setRegister({ ...register, terms: e.target.checked })}/><span/>أوافق على <a href="#terms">الشروط والأحكام</a> و<a href="#privacy">سياسة الخصوصية</a>.</label>
            <button className="account-primary" disabled={busy}>{busy ? <i className="account-spinner"/> : <>إنشاء حساب NEXORA <SvgIcon name="arrow"/></>}</button>
          </form>}

          {mode === 'forgot' && <form className="account-form forgot-form" onSubmit={submitForgot}>
            <div className="forgot-icon"><SvgIcon name="lock"/></div>
            <Field icon="mail" label="البريد الإلكتروني المسجل" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/>
            <button className="account-primary" disabled={busy}>{busy ? <i className="account-spinner"/> : <>إرسال تعليمات الاستعادة <SvgIcon name="arrow"/></>}</button>
            <button type="button" className="back-to-login" onClick={() => setMode('login')}><SvgIcon name="back"/> العودة لتسجيل الدخول</button>
          </form>}

          {mode !== 'forgot' && <>
            <div className="account-divider"><span>أو أكمل باستخدام</span></div>
            <div className="google-area">
              {GOOGLE_CLIENT_ID ? <div ref={googleRef} className="google-render"/> : <button type="button" className="google-placeholder" disabled><GoogleGlyph/> المتابعة باستخدام Google <small>يتطلب تفعيل Google Login</small></button>}
            </div>
            <p className="account-footnote"><SvgIcon name="shield"/> اتصال آمن ومشفر. لن نشارك بياناتك مع جهات خارجية.</p>
          </>}
        </>}
      </section>
    </section>
  </main>;
}
