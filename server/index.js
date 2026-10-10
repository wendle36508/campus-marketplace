// App entry point: JSON API under /api, the mobile web app from /public.
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { db } = require('./db');
const { ensureSchema } = require('./schema');
const { seedIfEmpty } = require('./seed');
const { CATEGORIES, CONDITIONS, REPORT_REASONS, SAFETY_TIPS } = require('./constants');
const { loadUser, getSchool, activeSchools, wrap, HttpError } = require('./lib');
const { auth, me } = require('./routes/auth');
const listings = require('./routes/listings');
const messages = require('./routes/messages');
const { safety, admin } = require('./routes/safety');
const photos = require('./routes/photos');
const { rateLimit } = require('./rate-limit');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
app.use(loadUser);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Public config: branding + product lists. Uses the signed-in user's school,
// or the default (first active) school on the sign-in screen.
app.get('/api/config', wrap(async (req, res) => {
  const schools = await activeSchools();
  const school = req.school || schools[0] || null;
  res.json({
    app_name: config.appName,
    school,
    schools: schools.map((s) => ({ name: s.name, short_name: s.short_name, email_domains: s.email_domains })),
    categories: CATEGORIES,
    conditions: CONDITIONS,
    report_reasons: REPORT_REASONS,
    safety_tips: SAFETY_TIPS,
    max_photos: config.maxPhotosPerListing,
    ai_enabled: !!config.ai.apiKey,
    dev_mode: config.devShowCodes,
  });
}));

// Slow down code-guessing and email spam
app.use('/api/auth/start', rateLimit({ windowMs: 15 * 60e3, max: 10, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' }));
app.use('/api/auth/verify', rateLimit({ windowMs: 15 * 60e3, max: 30, message: 'Too many attempts. Please wait a few minutes and try again.' }));
app.use('/api/auth', auth);
app.use('/api/me', me);
app.use('/api', photos.api);
app.use('/api', listings);
app.use('/api', messages);
app.use('/api', safety);
app.use('/api/admin', admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use(photos.serve);
app.use(express.static(path.join(config.root, 'public'), { maxAge: config.isProduction ? '1h' : 0 }));
app.get('/', (_req, res) => res.sendFile(path.join(config.root, 'public', 'index.html')));

// Errors -> friendly JSON
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That photo is too large (max 10 MB).' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const known = err instanceof HttpError;
  res.status(status).json({ error: status >= 500 && !known ? 'Something went wrong. Please try again.' : err.message, code: err.code });
});

async function main() {
  const unsafe = config.unsafeProductionSettings();
  if (unsafe.length) {
    console.error('Refusing to start in production:\n' + unsafe.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  await ensureSchema();
  if (config.seedDemoData) await seedIfEmpty();
  else await seedIfEmpty({ schoolOnly: true });
  app.listen(config.port, () => {
    console.log(`\n${config.appName} running at ${config.appUrl}`);
    console.log(`  database: ${config.databaseUrl ? 'Postgres' : `SQLite (${path.relative(config.root, config.sqlitePath)})`}`);
    console.log(`  email:    ${config.email.provider}${config.devShowCodes ? ' (codes shown on screen: dev mode)' : ''}`);
    console.log(`  AI price: ${config.ai.apiKey ? `Claude (${config.ai.model})` : 'demo mode (set ANTHROPIC_API_KEY for real suggestions)'}\n`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, getSchool, db };
