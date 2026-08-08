import crypto from 'crypto';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function configuredKey() {
  return String(process.env.ADMIN_API_KEY || '');
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function sign(encodedPayload) {
  return crypto.createHmac('sha256', configuredKey()).update(encodedPayload).digest('base64url');
}

export function verifyAdminKey(value) {
  const key = configuredKey();
  return Boolean(key) && secureEqual(value, key);
}

export function createAdminToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: 'admin',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    jti: crypto.randomUUID()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    expiresIn: SESSION_TTL_SECONDS
  };
}

export function verifyAdminToken(token) {
  try {
    if (!configuredKey()) return null;
    const [encodedPayload, signature] = String(token || '').split('.');
    if (!encodedPayload || !signature) return null;
    const expected = sign(encodedPayload);
    if (!secureEqual(signature, expected)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.role !== 'admin' || !payload?.exp || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res, next) {
  if (!configuredKey()) {
    return res.status(503).json({ error: 'ADMIN_API_KEY is not configured on the server.' });
  }

  const directKey = req.get('x-admin-key');
  if (directKey && verifyAdminKey(directKey)) {
    req.admin = { role: 'admin', method: 'api-key' };
    return next();
  }

  const authorization = String(req.get('authorization') || '');
  if (authorization.startsWith('Bearer ')) {
    const payload = verifyAdminToken(authorization.slice(7));
    if (payload) {
      req.admin = payload;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
}
