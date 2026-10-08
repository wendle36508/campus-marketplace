// Adds a new college. Copy schools/babson.json, edit it, then run:
//   npm run add-school -- schools/your-school.json
// That's it: students with that email domain get their own private marketplace.
const path = require('path');
const { db } = require('../server/db');
const { ensureSchema } = require('../server/schema');
const { insertSchool, loadSchoolFile } = require('../server/seed');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run add-school -- schools/your-school.json');
    process.exit(1);
  }
  await ensureSchema();
  const def = loadSchoolFile(path.resolve(file));
  for (const k of ['slug', 'name', 'short_name', 'email_domains', 'primary_color']) {
    if (!def[k]) throw new Error(`Missing "${k}" in ${file}`);
  }
  if (await db('schools').where({ slug: def.slug }).first()) throw new Error(`A school with slug "${def.slug}" already exists.`);
  const row = await insertSchool(def);
  console.log(`Added ${row.name} (${JSON.parse(row.email_domains).join(', ')}).`);
  await db.destroy();
})().catch((e) => { console.error(e.message); process.exit(1); });
