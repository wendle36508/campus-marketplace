// Creates tables if they don't exist yet. Safe to run on every boot.
//
// Multi-school design: every user, listing, conversation and report carries a
// school_id, and every read is filtered by the signed-in user's school_id.
// Adding a college = adding a row to `schools` (see scripts/add-school.js).
const { db } = require('./db');

async function createTable(name, build) {
  if (!(await db.schema.hasTable(name))) {
    await db.schema.createTable(name, build);
  }
}

async function ensureSchema() {
  await createTable('schools', (t) => {
    t.string('id').primary();
    t.string('slug').notNullable().unique();
    t.string('name').notNullable(); // "Babson College"
    t.string('short_name').notNullable(); // "Babson"
    t.text('email_domains').notNullable(); // JSON array: ["babson.edu"]
    t.string('primary_color').notNullable(); // accent color
    t.string('primary_color_dark');
    t.string('logo_url');
    t.text('meetup_spots').notNullable(); // JSON array of {name, description}
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('created_at').notNullable();
  });

  await createTable('users', (t) => {
    t.string('id').primary();
    t.string('school_id').notNullable().index();
    t.string('email').notNullable().unique(); // never sent to other users
    t.string('first_name');
    t.string('last_initial', 1);
    t.integer('grad_year');
    t.string('photo_url');
    t.string('role').notNullable().defaultTo('student'); // student | admin
    t.string('status').notNullable().defaultTo('active'); // active | banned
    t.string('ban_reason');
    t.string('verified_at');
    t.boolean('safety_tips_seen').notNullable().defaultTo(false);
    t.string('created_at').notNullable();
  });

  await createTable('verification_codes', (t) => {
    t.string('id').primary();
    t.string('email').notNullable().index();
    t.string('code_hash').notNullable();
    t.string('token_hash').notNullable().index(); // magic link token
    t.integer('attempts').notNullable().defaultTo(0);
    t.string('expires_at').notNullable();
    t.string('used_at');
    t.string('created_at').notNullable();
  });

  await createTable('sessions', (t) => {
    t.string('token_hash').primary();
    t.string('user_id').notNullable().index();
    t.string('expires_at').notNullable();
    t.string('created_at').notNullable();
  });

  await createTable('listings', (t) => {
    t.string('id').primary();
    t.string('school_id').notNullable().index();
    t.string('seller_id').notNullable().index();
    t.string('title').notNullable();
    t.text('description');
    t.integer('price_cents').notNullable();
    t.string('category').notNullable();
    t.string('condition').notNullable();
    t.string('pickup_location');
    t.boolean('move_out_sale').notNullable().defaultTo(false);
    t.string('status').notNullable().defaultTo('active'); // active | pending | sold | removed
    t.string('moderation').notNullable().defaultTo('ok'); // ok | flagged | approved
    t.text('moderation_reasons'); // JSON array
    t.string('sold_to_user_id');
    t.text('ai_suggestion'); // JSON of the AI suggestion shown at posting time
    t.string('created_at').notNullable();
    t.string('updated_at').notNullable();
  });

  await createTable('listing_photos', (t) => {
    t.string('id').primary();
    t.string('listing_id').notNullable().index();
    t.string('url').notNullable();
    t.integer('position').notNullable().defaultTo(0);
  });

  await createTable('photos', (t) => {
    t.string('id').primary();
    t.string('uploader_id').notNullable().index();
    t.string('mime').notNullable();
    t.integer('size').notNullable();
    t.binary('data').notNullable();
    t.string('created_at').notNullable();
  });

  await createTable('conversations', (t) => {
    t.string('id').primary();
    t.string('school_id').notNullable().index();
    t.string('listing_id').notNullable().index();
    t.string('buyer_id').notNullable().index();
    t.string('seller_id').notNullable().index();
    t.string('buyer_last_read_at');
    t.string('seller_last_read_at');
    t.string('last_message_at').notNullable();
    t.string('created_at').notNullable();
    t.unique(['listing_id', 'buyer_id']);
  });

  await createTable('messages', (t) => {
    t.string('id').primary();
    t.string('conversation_id').notNullable().index();
    t.string('sender_id').notNullable();
    t.string('kind').notNullable().defaultTo('text'); // text | meetup | system
    t.text('body').notNullable();
    t.string('created_at').notNullable();
  });

  await createTable('reports', (t) => {
    t.string('id').primary();
    t.string('school_id').notNullable().index();
    t.string('reporter_id').notNullable();
    t.string('listing_id');
    t.string('reported_user_id');
    t.string('reason').notNullable(); // scam | inappropriate | prohibited | no_show | other
    t.text('details');
    t.string('status').notNullable().defaultTo('open'); // open | resolved | dismissed
    t.string('resolved_by');
    t.string('created_at').notNullable();
  });

  await createTable('blocks', (t) => {
    t.string('blocker_id').notNullable();
    t.string('blocked_id').notNullable();
    t.string('created_at').notNullable();
    t.primary(['blocker_id', 'blocked_id']);
  });

  await createTable('ratings', (t) => {
    t.string('id').primary();
    t.string('listing_id').notNullable();
    t.string('rater_id').notNullable();
    t.string('seller_id').notNullable().index();
    t.integer('value').notNullable(); // 1 = thumbs up, -1 = thumbs down
    t.string('created_at').notNullable();
    t.unique(['listing_id', 'rater_id']);
  });
}

module.exports = { ensureSchema };
