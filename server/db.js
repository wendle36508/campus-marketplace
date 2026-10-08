// Database connection. SQLite for local demos, Postgres for production.
// All queries go through Knex so the same code runs on both.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const knex = require('knex');
const config = require('./config');

let db;
if (config.databaseUrl) {
  db = knex({
    client: 'pg',
    connection: config.databaseUrl,
    pool: { min: 0, max: 10 },
  });
} else {
  fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  db = knex({
    client: 'better-sqlite3',
    connection: { filename: config.sqlitePath },
    useNullAsDefault: true,
  });
}

// Short, URL-safe, non-sequential ids (so listing/user ids can't be enumerated).
function newId() {
  return crypto.randomBytes(9).toString('base64url');
}

function now() {
  return new Date().toISOString();
}

// JSON columns are stored as text so they behave the same on SQLite and Postgres.
function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = { db, newId, now, parseJson };
