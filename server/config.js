// Central configuration. Everything that differs between environments
// (keys, URLs, branding) comes from environment variables / .env.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;
const ROOT = path.join(__dirname, '..');

function bool(v, fallback) {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const emailProvider = (env.EMAIL_PROVIDER || 'console').toLowerCase();

const config = {
  root: ROOT,
  port: Number(env.PORT || 3000),
  // Render sets RENDER_EXTERNAL_URL automatically.
  appUrl: (env.APP_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  appName: env.APP_NAME || '[APP NAME]',
  isProduction: env.NODE_ENV === 'production',

  // Database: SQLite file by default, Postgres when DATABASE_URL is set.
  databaseUrl: env.DATABASE_URL || '',
  sqlitePath: env.SQLITE_PATH || path.join(ROOT, 'data', 'marketplace.sqlite'),

  // Email: console (dev) | resend | smtp
  email: {
    provider: emailProvider,
    from: env.EMAIL_FROM || 'Campus Marketplace <onboarding@resend.dev>',
    resendApiKey: env.RESEND_API_KEY || '',
    brevoApiKey: env.BREVO_API_KEY || '',
    smtp: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT || 587),
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      secure: bool(env.SMTP_SECURE, false),
    },
  },
  // Show the verification code on screen instead of emailing it. On by default
  // in local dev; the hosted prototype turns it on too (render.yaml) so testers
  // don't need email. Turn it off once real email sending is set up.
  devShowCodes: bool(env.DEV_SHOW_CODES, emailProvider === 'console' && env.NODE_ENV !== 'production'),

  // School emails that get the admin dashboard, comma separated.
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),

  // Fill an empty database with demo listings so the app looks alive.
  seedDemoData: bool(env.SEED_DEMO_DATA, true),

  // AI pricing: uses Claude when ANTHROPIC_API_KEY is set, a mock otherwise.
  ai: {
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.AI_MODEL || 'claude-opus-5-5',
  },

  maxPhotosPerListing: 5,
  sessionDays: Number(env.SESSION_DAYS || 30),
};

module.exports = config;
