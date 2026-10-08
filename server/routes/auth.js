// Sign up / sign in with a school email, verified by a 6-digit code or magic link.
const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { db, newId, now } = require('../db');
const { sendVerificationEmail } = require('../services/email');
const {
  HttpError, wrap, sha256, schoolForEmail, activeSchools, getSchool,
  SESSION_COOKIE, requireUser, selfUser, userStats,
} = require('../lib');

const router = express.Router();
const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 30;

const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function notOpenMessage(schools) {
  const names = schools.map((s) => s.short_name);
  const list = names.length <= 1 ? names[0] || 'select' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Right now we're only open to ${list} students. Use your school email${schools.length === 1 ? ` (@${schools[0].email_domains[0]})` : ''}.`;
}

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 864e5);
  await db('sessions').insert({ token_hash: sha256(token), user_id: userId, expires_at: expires.toISOString(), created_at: now() });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    expires,
  });
}

// Creates the user on first successful verification.
async function upsertVerifiedUser(email) {
  const school = await schoolForEmail(email);
  if (!school) throw new HttpError(400, notOpenMessage(await activeSchools()), 'school_not_supported');
  let user = await db('users').where({ email }).first();
  if (!user) {
    user = { id: newId(), school_id: school.id, email, role: 'student', status: 'active', verified_at: now(), created_at: now(), safety_tips_seen: false };
    await db('users').insert(user);
  } else if (!user.verified_at) {
    await db('users').where({ id: user.id }).update({ verified_at: now() });
  }
  if (config.adminEmails.includes(email) && user.role !== 'admin') {
    await db('users').where({ email }).update({ role: 'admin' });
  }
  user = await db('users').where({ email }).first();
  if (user.status === 'banned') throw new HttpError(403, 'This account has been suspended. Contact campus support if you think this is a mistake.', 'banned');
  return user;
}

// Step 1: request a code
router.post('/start', wrap(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'That doesn\'t look like an email address.', 'invalid_email');

  const school = await schoolForEmail(email);
  if (!school) throw new HttpError(400, notOpenMessage(await activeSchools()), 'school_not_supported');

  const existing = await db('users').where({ email }).first();
  if (existing && existing.status === 'banned') throw new HttpError(403, 'This account has been suspended.', 'banned');

  const recent = await db('verification_codes').where({ email }).orderBy('created_at', 'desc').first();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_SEC * 1000) {
    throw new HttpError(429, `We just sent a code. You can request another in ${RESEND_COOLDOWN_SEC} seconds.`, 'cooldown');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const token = crypto.randomBytes(24).toString('base64url');
  await db('verification_codes').insert({
    id: newId(),
    email,
    code_hash: sha256(`${email}:${code}`),
    token_hash: sha256(token),
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60e3).toISOString(),
    created_at: now(),
  });

  const magicUrl = `${config.appUrl}/api/auth/magic?token=${token}`;
  try {
    await sendVerificationEmail({ to: email, code, magicUrl, schoolName: school.short_name });
  } catch (err) {
    console.error('[email] send failed:', err.message);
    throw new HttpError(502, 'We couldn\'t send the email right now. Please try again in a minute.', 'email_failed');
  }

  res.json({ ok: true, email, school: school.short_name, ...(config.devShowCodes ? { dev_code: code } : {}) });
}));

// Step 2a: enter the 6-digit code
router.post('/verify', wrap(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').replace(/\D/g, '');
  const record = await db('verification_codes').where({ email }).whereNull('used_at').orderBy('created_at', 'desc').first();
  if (!record || record.expires_at < now()) throw new HttpError(400, 'That code has expired. Tap "Resend code" to get a new one.', 'expired');
  if (record.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many tries. Request a new code.', 'too_many_attempts');
  if (record.code_hash !== sha256(`${email}:${code}`)) {
    await db('verification_codes').where({ id: record.id }).update({ attempts: record.attempts + 1 });
    throw new HttpError(400, 'That code isn\'t right. Check the email and try again.', 'wrong_code');
  }
  await db('verification_codes').where({ id: record.id }).update({ used_at: now() });
  const user = await upsertVerifiedUser(email);
  await startSession(res, user.id);
  res.json({ ok: true, profile_complete: !!user.first_name });
}));

// Step 2b: magic link from the email
router.get('/magic', wrap(async (req, res) => {
  const token = String(req.query.token || '');
  const record = await db('verification_codes').where({ token_hash: sha256(token) }).first();
  if (!record || record.used_at || record.expires_at < now()) {
    return res.redirect('/#/welcome?error=link_expired');
  }
  await db('verification_codes').where({ id: record.id }).update({ used_at: now() });
  try {
    const user = await upsertVerifiedUser(record.email);
    await startSession(res, user.id);
    res.redirect(user.first_name ? '/#/' : '/#/onboarding');
  } catch (err) {
    res.redirect(`/#/welcome?error=${err.code || 'failed'}`);
  }
}));

router.post('/logout', wrap(async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await db('sessions').where({ token_hash: sha256(token) }).del();
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
}));

// ---- the signed-in user -----------------------------------------------------
const me = express.Router();

me.get('/', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const stats = await userStats([req.user.id]);
  res.json({ user: selfUser(req.user, req.school, stats) });
}));

me.put('/', requireUser, wrap(async (req, res) => {
  const first = String(req.body.first_name || '').trim().replace(/\s+/g, ' ');
  const initial = String(req.body.last_initial || '').trim().charAt(0).toUpperCase();
  const year = Number(req.body.grad_year);
  const thisYear = new Date().getFullYear();
  if (!first || first.length > 30) throw new HttpError(400, 'Please enter your first name (up to 30 characters).');
  if (!/^[A-Z]$/.test(initial)) throw new HttpError(400, 'Please enter your last initial (one letter).');
  if (!Number.isInteger(year) || year < thisYear - 1 || year > thisYear + 7) throw new HttpError(400, 'Please pick your graduation year.');
  const photo = req.body.photo_url ? String(req.body.photo_url) : null;
  if (photo && !photo.startsWith('/uploads/')) throw new HttpError(400, 'Invalid photo.');
  await db('users').where({ id: req.user.id }).update({ first_name: first, last_initial: initial, grad_year: year, photo_url: photo });
  const user = await db('users').where({ id: req.user.id }).first();
  res.json({ user: selfUser(user, await getSchool(user.school_id), await userStats([user.id])) });
}));

me.post('/safety-tips-seen', requireUser, wrap(async (req, res) => {
  await db('users').where({ id: req.user.id }).update({ safety_tips_seen: true });
  res.json({ ok: true });
}));

module.exports = { auth: router, me };
