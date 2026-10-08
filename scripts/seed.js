// npm run seed   -> seeds demo data if the database is empty
// npm run reset  -> wipes everything and re-seeds the demo
const { db } = require('../server/db');
const { ensureSchema } = require('../server/schema');
const { seedIfEmpty, resetAll } = require('../server/seed');

(async () => {
  await ensureSchema();
  if (process.argv.includes('--reset')) {
    await resetAll();
    console.log('Database reset and demo data re-seeded.');
  } else {
    const seeded = await seedIfEmpty();
    console.log(seeded ? 'Demo data seeded.' : 'Database already has data. Use "npm run reset" to start over.');
  }
  await db.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
