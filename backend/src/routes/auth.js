import { Router } from 'express';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const router = Router();
const SESSION_DAYS = 30;
const RESET_MINUTES = 30;

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(8).max(128).refine((value) => /\d/.test(value), 'Password must include a number.');

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().min(9).max(20),
  password: passwordSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
});

const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({ token: z.string().min(20).max(300), password: passwordSchema });
const googleSchema = z.object({ credential: z.string().min(100) });

function normalizePhone(value) {
  const clean = String(value || '').replace(/[\s()-]/g, '');
  if (/^05\d{8}$/.test(clean)) return `+966${clean.slice(1)}`;
  if (/^5\d{8}$/.test(clean)) return `+966${clean}`;
  if (/^9665\d{8}$/.test(clean)) return `+${clean}`;
  if (/^\+9665\d{8}$/.test(clean)) return clean;
  if (/^\+?[1-9]\d{7,14}$/.test(clean)) return clean.startsWith('+') ? clean : `+${clean}`;
  const error = new Error('INVALID_PHONE');
  error.code = 'INVALID_PHONE';
  throw error;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function verifyPassword(password, encoded) {
  try {
    const [algorithm, saltText, hashText] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const stored = Buffer.from(hashText, 'base64url');
    const candidate = scryptSync(password, salt, stored.length);
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  } catch {
    return false;
  }
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    profileComplete: Boolean(user.fullName && user.email && user.phone)
  };
}

async function issueSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.customerSession.create({
    data: { userId, tokenHash: tokenHash(token), expiresAt }
  });
  return { token, expiresAt };
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  const [type, value] = header.split(' ');
  return type?.toLowerCase() === 'bearer' && value ? value : null;
}

async function getSessionUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true }
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  return { session, user: session.user };
}

router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const phone = normalizePhone(input.phone);
    const existing = await prisma.customerUser.findFirst({
      where: { OR: [{ email }, { phone }] }
    });
    if (existing) {
      return res.status(409).json({ error: 'ACCOUNT_EXISTS', message: 'البريد الإلكتروني أو رقم الجوال مستخدم في حساب آخر.' });
    }

    const user = await prisma.customerUser.create({
      data: {
        fullName: input.fullName,
        email,
        phone,
        passwordHash: hashPassword(input.password),
        provider: 'LOCAL'
      }
    });
    const session = await issueSession(user.id);
    res.status(201).json({ data: { user: publicUser(user), ...session } });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.customerUser.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'هذا الحساب غير متاح حاليًا.' });
    }
    const session = await issueSession(user.id);
    res.json({ data: { user: publicUser(user), ...session } });
  } catch (error) {
    next(error);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = googleSchema.parse(req.body);
    const expectedAudience = String(process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!expectedAudience) {
      return res.status(503).json({ error: 'GOOGLE_LOGIN_NOT_CONFIGURED', message: 'تسجيل Google لم يتم تهيئته على الخادم بعد.' });
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const profile = await response.json().catch(() => ({}));
    if (!response.ok || profile.aud !== expectedAudience || String(profile.email_verified) !== 'true') {
      return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN', message: 'تعذر التحقق من تسجيل الدخول عبر Google.' });
    }

    const email = String(profile.email || '').trim().toLowerCase();
    if (!email || !profile.sub) {
      return res.status(401).json({ error: 'INVALID_GOOGLE_PROFILE', message: 'حساب Google لا يحتوي على بيانات كافية.' });
    }

    let user = await prisma.customerUser.findFirst({
      where: { OR: [{ googleSub: String(profile.sub) }, { email }] }
    });

    if (user) {
      user = await prisma.customerUser.update({
        where: { id: user.id },
        data: {
          googleSub: user.googleSub || String(profile.sub),
          avatarUrl: profile.picture || user.avatarUrl,
          emailVerified: true,
          provider: user.passwordHash ? 'LOCAL_GOOGLE' : 'GOOGLE'
        }
      });
    } else {
      user = await prisma.customerUser.create({
        data: {
          fullName: String(profile.name || email.split('@')[0]).slice(0, 120),
          email,
          googleSub: String(profile.sub),
          avatarUrl: profile.picture || null,
          provider: 'GOOGLE',
          emailVerified: true
        }
      });
    }

    const session = await issueSession(user.id);
    res.json({ data: { user: publicUser(user), ...session } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const auth = await getSessionUser(req);
    if (!auth) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    res.json({ data: { user: publicUser(auth.user), expiresAt: auth.session.expiresAt } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = bearer(req);
    if (token) await prisma.customerSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
    res.json({ data: { loggedOut: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.customerUser.findUnique({ where: { email: email.toLowerCase() } });
    if (user?.passwordHash) {
      const token = randomBytes(32).toString('base64url');
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000)
        }
      });
      // Delivery is intentionally separated from token creation. A mail provider
      // can consume this flow without ever storing the raw token in PostgreSQL.
      if (process.env.NODE_ENV !== 'production') console.log(`Password reset token for ${email}: ${token}`);
    }
    res.json({
      data: {
        accepted: true,
        message: 'إذا كان البريد مسجلًا فسيتم إرسال تعليمات استعادة كلمة المرور.',
        deliveryConfigured: false
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const input = resetSchema.parse(req.body);
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: tokenHash(input.token) },
      include: { user: true }
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      return res.status(400).json({ error: 'RESET_TOKEN_INVALID', message: 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' });
    }
    await prisma.$transaction([
      prisma.customerUser.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(input.password) } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.customerSession.deleteMany({ where: { userId: reset.userId } })
    ]);
    res.json({ data: { reset: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
