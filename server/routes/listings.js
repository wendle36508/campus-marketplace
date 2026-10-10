// Listings: feed, search, create (with AI pricing), edit, status, ratings.
// Every query is scoped to req.user.school_id.
const express = require('express');
const config = require('../config');
const { db, newId, now } = require('../db');
const { CATEGORIES, CONDITIONS } = require('../constants');
const { checkText } = require('../services/moderation');
const { suggestFromPhoto } = require('../services/ai');
const { getPhoto, validPhoto } = require('./photos');
const { HttpError, wrap, requireMember, hydrateListings, blockedIds, publicUser, userStats, isAdmin: isAdminUser } = require('../lib');

const router = express.Router();
router.use(requireMember);

// ---- AI price suggestion ----------------------------------------------------
router.post('/ai/suggest', wrap(async (req, res) => {
  const photo = await getPhoto(req.body.photo_url);
  if (!photo) throw new HttpError(400, 'Upload a photo first.');
  const suggestion = await suggestFromPhoto({
    data: Buffer.from(photo.data),
    mediaType: photo.mime,
    hint: String(req.body.hint || ''),
    schoolName: req.school.name,
  });
  res.json({ suggestion });
}));

// ---- moderation pre-check (used live in the create form) --------------------
router.post('/moderation/check', wrap(async (req, res) => {
  res.json(checkText(req.body.title, req.body.description));
}));

const allValid = async (urls) => (await Promise.all(urls.map(validPhoto))).every(Boolean);

// ---- feed + search ----------------------------------------------------------
router.get('/listings', wrap(async (req, res) => {
  const { q, category, condition, min, max, move_out, sort, seller } = req.query;
  const blocked = await blockedIds(req.user.id);

  let query = db('listings')
    .where('school_id', req.user.school_id)
    .whereIn('status', ['active', 'pending'])
    .whereNot('moderation', 'flagged');
  if (blocked.length) query = query.whereNotIn('seller_id', blocked);
  // hide listings from banned sellers
  query = query.whereNotIn('seller_id', db('users').select('id').where({ status: 'banned' }));

  if (q && String(q).trim()) {
    const words = String(q).toLowerCase().trim().split(/\s+/).slice(0, 6);
    for (const w of words) {
      const like = `%${w}%`;
      query = query.where((b) => b.whereRaw('lower(title) like ?', [like]).orWhereRaw('lower(description) like ?', [like]).orWhereRaw('lower(category) like ?', [like]));
    }
  }
  if (category && CATEGORIES.includes(category)) query = query.where({ category });
  if (condition) {
    const list = String(condition).split(',').filter((c) => CONDITIONS.includes(c));
    if (list.length) query = query.whereIn('condition', list);
  }
  if (min !== undefined && min !== '') query = query.where('price_cents', '>=', Math.round(Number(min) * 100) || 0);
  if (max !== undefined && max !== '') query = query.where('price_cents', '<=', Math.round(Number(max) * 100) || 0);
  if (move_out === '1' || move_out === 'true') query = query.where({ move_out_sale: true });
  if (seller) query = query.where({ seller_id: String(seller) });

  if (sort === 'price_asc') query = query.orderBy('price_cents', 'asc');
  else if (sort === 'price_desc') query = query.orderBy('price_cents', 'desc');
  else query = query.orderBy('created_at', 'desc');

  const rows = await query.limit(100);
  res.json({ listings: await hydrateListings(rows, req.school, req.user) });
}));

// The signed-in user's own listings, any status except removed
router.get('/my/listings', wrap(async (req, res) => {
  const rows = await db('listings').where({ seller_id: req.user.id }).whereNot('status', 'removed').orderBy('created_at', 'desc');
  res.json({ listings: await hydrateListings(rows, req.school, req.user) });
}));

async function loadListing(req, { forWrite = false } = {}) {
  const row = await db('listings').where({ id: req.params.id, school_id: req.user.school_id }).first();
  if (!row) throw new HttpError(404, 'Listing not found.');
  const isOwner = row.seller_id === req.user.id;
  const isAdmin = isAdminUser(req.user);
  if (forWrite && !isOwner) throw new HttpError(403, 'Only the seller can change this listing.');
  if (!isOwner && !isAdmin) {
    if (row.status === 'removed' || row.moderation === 'flagged') throw new HttpError(404, 'Listing not found.');
    const blocked = await blockedIds(req.user.id);
    if (blocked.includes(row.seller_id)) throw new HttpError(404, 'Listing not found.');
  }
  return row;
}

router.get('/listings/:id', wrap(async (req, res) => {
  const row = await loadListing(req);
  const [listing] = await hydrateListings([row], req.school, req.user);
  // existing conversation for this buyer, if any
  const convo = await db('conversations').where({ listing_id: row.id, buyer_id: req.user.id }).first();
  listing.conversation_id = convo ? convo.id : null;
  if (row.sold_to_user_id === req.user.id) {
    const rating = await db('ratings').where({ listing_id: row.id, rater_id: req.user.id }).first();
    listing.can_rate = !rating;
    listing.my_rating = rating ? rating.value : null;
  }
  if (listing.is_mine) {
    // buyers who messaged, so the seller can say who bought it
    const convos = await db('conversations').where({ listing_id: row.id });
    const buyers = await db('users').whereIn('id', convos.map((c) => c.buyer_id));
    listing.interested_buyers = buyers.map((b) => publicUser(b, req.school));
  }
  res.json({ listing });
}));

function validateListing(body, partial = false) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('title')) {
    const title = String(body.title || '').trim();
    if (!title || title.length > 80) throw new HttpError(400, 'Add a title (up to 80 characters).');
    out.title = title;
  }
  if (!partial || has('description')) out.description = String(body.description || '').trim().slice(0, 2000);
  if (!partial || has('price')) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new HttpError(400, 'Enter a price between $0 and $100,000.');
    out.price_cents = Math.round(price * 100);
  }
  if (!partial || has('category')) {
    if (!CATEGORIES.includes(body.category)) throw new HttpError(400, 'Pick a category.');
    out.category = body.category;
  }
  if (!partial || has('condition')) {
    if (!CONDITIONS.includes(body.condition)) throw new HttpError(400, 'Pick a condition.');
    out.condition = body.condition;
  }
  if (!partial || has('pickup_location')) out.pickup_location = String(body.pickup_location || '').trim().slice(0, 120) || null;
  if (!partial || has('move_out_sale')) out.move_out_sale = !!body.move_out_sale;
  // Free Stuff is always $0
  if (out.category === 'Free Stuff') out.price_cents = 0;
  return out;
}

router.post('/listings', wrap(async (req, res) => {
  const fields = validateListing(req.body);
  const photos = (Array.isArray(req.body.photos) ? req.body.photos : []).slice(0, config.maxPhotosPerListing);
  if (!photos.length) throw new HttpError(400, 'Add at least one photo.');
  if (!(await allValid(photos))) throw new HttpError(400, 'One of the photos didn\'t upload. Please try again.');

  const mod = checkText(fields.title, fields.description);
  const id = newId();
  await db('listings').insert({
    id,
    school_id: req.user.school_id,
    seller_id: req.user.id,
    ...fields,
    status: 'active',
    moderation: mod.flagged ? 'flagged' : 'ok',
    moderation_reasons: JSON.stringify(mod.reasons),
    ai_suggestion: req.body.ai_suggestion ? JSON.stringify(req.body.ai_suggestion).slice(0, 4000) : null,
    created_at: now(),
    updated_at: now(),
  });
  await db('listing_photos').insert(photos.map((url, i) => ({ id: newId(), listing_id: id, url, position: i })));
  const [listing] = await hydrateListings([await db('listings').where({ id }).first()], req.school, req.user);
  res.status(201).json({ listing, flagged: mod.flagged, reasons: mod.reasons });
}));

router.patch('/listings/:id', wrap(async (req, res) => {
  const row = await loadListing(req, { forWrite: true });
  if (row.status === 'removed') throw new HttpError(400, 'This listing was removed by an admin.');
  const fields = validateListing(req.body, true);

  if (req.body.status !== undefined) {
    if (!['active', 'pending', 'sold'].includes(req.body.status)) throw new HttpError(400, 'Invalid status.');
    fields.status = req.body.status;
    if (req.body.status === 'sold') {
      const buyer = req.body.sold_to_user_id ? String(req.body.sold_to_user_id) : null;
      if (buyer) {
        const convo = await db('conversations').where({ listing_id: row.id, buyer_id: buyer }).first();
        if (!convo) throw new HttpError(400, 'You can only mark it sold to someone who messaged you about it.');
      }
      fields.sold_to_user_id = buyer;
    } else {
      fields.sold_to_user_id = null;
    }
  }

  if (fields.title !== undefined || fields.description !== undefined) {
    const mod = checkText(fields.title ?? row.title, fields.description ?? row.description);
    if (mod.flagged && row.moderation !== 'approved') {
      fields.moderation = 'flagged';
      fields.moderation_reasons = JSON.stringify(mod.reasons);
    } else if (!mod.flagged && row.moderation === 'flagged') {
      fields.moderation = 'ok';
      fields.moderation_reasons = '[]';
    }
  }
  if (Array.isArray(req.body.photos)) {
    const photos = req.body.photos.slice(0, config.maxPhotosPerListing);
    if (!photos.length || !(await allValid(photos))) throw new HttpError(400, 'Add at least one photo.');
    await db('listing_photos').where({ listing_id: row.id }).del();
    await db('listing_photos').insert(photos.map((url, i) => ({ id: newId(), listing_id: row.id, url, position: i })));
  }

  await db('listings').where({ id: row.id }).update({ ...fields, updated_at: now() });

  // Post a system note into each chat when the status changes
  if (fields.status && fields.status !== row.status) {
    const label = { active: 'available again', pending: 'pending', sold: 'sold' }[fields.status];
    const convos = await db('conversations').where({ listing_id: row.id });
    for (const c of convos) {
      await db('messages').insert({ id: newId(), conversation_id: c.id, sender_id: req.user.id, kind: 'system', body: `Seller marked this item ${label}.`, created_at: now() });
      await db('conversations').where({ id: c.id }).update({ last_message_at: now() });
    }
  }

  const [listing] = await hydrateListings([await db('listings').where({ id: row.id }).first()], req.school, req.user);
  res.json({ listing });
}));

router.delete('/listings/:id', wrap(async (req, res) => {
  const row = await loadListing(req, { forWrite: true });
  await db('listings').where({ id: row.id }).update({ status: 'removed', updated_at: now() });
  res.json({ ok: true });
}));

// ---- thumbs up/down after a completed sale ----------------------------------
router.post('/listings/:id/rating', wrap(async (req, res) => {
  const row = await loadListing(req);
  if (row.status !== 'sold' || row.sold_to_user_id !== req.user.id) throw new HttpError(403, 'Only the buyer can rate this sale.');
  const value = Number(req.body.value) > 0 ? 1 : -1;
  const existing = await db('ratings').where({ listing_id: row.id, rater_id: req.user.id }).first();
  if (existing) throw new HttpError(400, 'You already rated this sale.');
  await db('ratings').insert({ id: newId(), listing_id: row.id, rater_id: req.user.id, seller_id: row.seller_id, value, created_at: now() });
  res.json({ ok: true });
}));

// ---- public profiles --------------------------------------------------------
router.get('/users/:id', wrap(async (req, res) => {
  const u = await db('users').where({ id: req.params.id, school_id: req.user.school_id }).first();
  if (!u || !u.first_name) throw new HttpError(404, 'Student not found.');
  const blocked = await blockedIds(req.user.id);
  const iBlocked = !!(await db('blocks').where({ blocker_id: req.user.id, blocked_id: u.id }).first());
  if (blocked.includes(u.id) && !iBlocked) throw new HttpError(404, 'Student not found.');
  const rows = iBlocked || u.status === 'banned'
    ? []
    : await db('listings').where({ seller_id: u.id, school_id: req.user.school_id }).whereIn('status', ['active', 'pending', 'sold']).whereNot('moderation', 'flagged').orderBy('created_at', 'desc').limit(50);
  res.json({
    user: publicUser(u, req.school, await userStats([u.id])),
    blocked_by_me: iBlocked,
    listings: await hydrateListings(rows, req.school, req.user),
  });
}));

module.exports = router;
