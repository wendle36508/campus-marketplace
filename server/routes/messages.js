// In-app chat between a buyer and the seller, always attached to a listing.
const express = require('express');
const { db, newId, now } = require('../db');
const { containsContactInfo } = require('../services/moderation');
const { HttpError, wrap, requireMember, hydrateListings, blockedIds, publicUser, userStats } = require('../lib');

const router = express.Router();
router.use(requireMember);

const MAX_LEN = 1000;

async function loadConversation(req) {
  const c = await db('conversations').where({ id: req.params.id, school_id: req.user.school_id }).first();
  if (!c || (c.buyer_id !== req.user.id && c.seller_id !== req.user.id)) throw new HttpError(404, 'Conversation not found.');
  return c;
}

async function addMessage(convo, senderId, body, kind = 'text') {
  const msg = { id: newId(), conversation_id: convo.id, sender_id: senderId, kind, body, created_at: now() };
  await db('messages').insert(msg);
  const readCol = senderId === convo.buyer_id ? 'buyer_last_read_at' : 'seller_last_read_at';
  await db('conversations').where({ id: convo.id }).update({ last_message_at: msg.created_at, [readCol]: msg.created_at });
  return msg;
}

async function assertNotBlocked(userId, otherId) {
  const blocked = await blockedIds(userId);
  if (blocked.includes(otherId)) throw new HttpError(403, 'You can\'t message this student.', 'blocked');
}

// Start (or reopen) a conversation about a listing, optionally with a first message.
router.post('/listings/:id/conversations', wrap(async (req, res) => {
  const listing = await db('listings').where({ id: req.params.id, school_id: req.user.school_id }).first();
  if (!listing || listing.status === 'removed' || listing.moderation === 'flagged') throw new HttpError(404, 'Listing not found.');
  if (listing.seller_id === req.user.id) throw new HttpError(400, 'This is your listing.');
  const seller = await db('users').where({ id: listing.seller_id }).first();
  if (seller.status === 'banned') throw new HttpError(400, 'This seller is no longer active.');
  await assertNotBlocked(req.user.id, listing.seller_id);

  let convo = await db('conversations').where({ listing_id: listing.id, buyer_id: req.user.id }).first();
  if (!convo) {
    convo = { id: newId(), school_id: req.user.school_id, listing_id: listing.id, buyer_id: req.user.id, seller_id: listing.seller_id, last_message_at: now(), created_at: now() };
    await db('conversations').insert(convo);
  }
  const text = String(req.body.message || '').trim().slice(0, MAX_LEN);
  if (text) await addMessage(convo, req.user.id, text);
  res.status(201).json({ conversation_id: convo.id });
}));

// Inbox
router.get('/conversations', wrap(async (req, res) => {
  const uid = req.user.id;
  const convos = await db('conversations')
    .where('school_id', req.user.school_id)
    .andWhere((b) => b.where({ buyer_id: uid }).orWhere({ seller_id: uid }))
    .orderBy('last_message_at', 'desc')
    .limit(100);
  if (!convos.length) return res.json({ conversations: [], unread: 0 });

  const listingRows = await db('listings').whereIn('id', convos.map((c) => c.listing_id));
  const listings = Object.fromEntries((await hydrateListings(listingRows, req.school, req.user)).map((l) => [l.id, l]));
  const otherIds = convos.map((c) => (c.buyer_id === uid ? c.seller_id : c.buyer_id));
  const others = Object.fromEntries((await db('users').whereIn('id', otherIds)).map((u) => [u.id, u]));
  const stats = await userStats(otherIds);

  let unread = 0;
  const out = [];
  for (const c of convos) {
    const last = await db('messages').where({ conversation_id: c.id }).orderBy('created_at', 'desc').first();
    if (!last) continue; // empty conversation
    const myRead = c.buyer_id === uid ? c.buyer_last_read_at : c.seller_last_read_at;
    const isUnread = last.sender_id !== uid && (!myRead || last.created_at > myRead);
    if (isUnread) unread++;
    const l = listings[c.listing_id];
    const otherId = c.buyer_id === uid ? c.seller_id : c.buyer_id;
    out.push({
      id: c.id,
      role: c.buyer_id === uid ? 'buyer' : 'seller',
      listing: l ? { id: l.id, title: l.title, price: l.price, status: l.status, photo: l.photos[0] || null } : null,
      other: publicUser(others[otherId], req.school, stats),
      last_message: { body: last.body, kind: last.kind, from_me: last.sender_id === uid, created_at: last.created_at },
      unread: isUnread,
    });
  }
  res.json({ conversations: out, unread });
}));

router.get('/conversations/unread', wrap(async (req, res) => {
  const uid = req.user.id;
  const convos = await db('conversations').where('school_id', req.user.school_id).andWhere((b) => b.where({ buyer_id: uid }).orWhere({ seller_id: uid }));
  let unread = 0;
  for (const c of convos) {
    const myRead = c.buyer_id === uid ? c.buyer_last_read_at : c.seller_last_read_at;
    const q = db('messages').where({ conversation_id: c.id }).whereNot({ sender_id: uid });
    const newer = await (myRead ? q.where('created_at', '>', myRead) : q).first();
    if (newer) unread++;
  }
  res.json({ unread });
}));

// One conversation with its messages. ?after=<iso> returns only newer messages (polling).
router.get('/conversations/:id', wrap(async (req, res) => {
  const c = await loadConversation(req);
  const uid = req.user.id;
  let q = db('messages').where({ conversation_id: c.id }).orderBy('created_at', 'asc');
  if (req.query.after) q = q.where('created_at', '>', String(req.query.after));
  const messages = (await q.limit(500)).map((m) => ({ id: m.id, kind: m.kind, body: m.body, from_me: m.sender_id === uid, created_at: m.created_at }));

  const readCol = c.buyer_id === uid ? 'buyer_last_read_at' : 'seller_last_read_at';
  await db('conversations').where({ id: c.id }).update({ [readCol]: now() });

  const listingRow = await db('listings').where({ id: c.listing_id }).first();
  const [listing] = await hydrateListings([listingRow], req.school, req.user);
  const otherId = c.buyer_id === uid ? c.seller_id : c.buyer_id;
  const other = await db('users').where({ id: otherId }).first();
  const blocked = (await blockedIds(uid)).includes(otherId);

  let rating = null;
  if (c.buyer_id === uid && listingRow.status === 'sold' && listingRow.sold_to_user_id === uid) {
    const r = await db('ratings').where({ listing_id: listingRow.id, rater_id: uid }).first();
    rating = { can_rate: !r, value: r ? r.value : null };
  }

  res.json({
    conversation: {
      id: c.id,
      role: c.buyer_id === uid ? 'buyer' : 'seller',
      buyer_id: c.buyer_id,
      listing: { id: listing.id, title: listing.title, price: listing.price, status: listing.status, photo: listing.photos[0] || null, pickup_location: listing.pickup_location, sold_to_user_id: listingRow.sold_to_user_id },
      other: publicUser(other, req.school, await userStats([otherId])),
      blocked,
      rating,
    },
    messages,
    meetup_spots: req.school.meetup_spots,
  });
}));

router.post('/conversations/:id/messages', wrap(async (req, res) => {
  const c = await loadConversation(req);
  const otherId = c.buyer_id === req.user.id ? c.seller_id : c.buyer_id;
  await assertNotBlocked(req.user.id, otherId);
  const other = await db('users').where({ id: otherId }).first();
  if (other.status === 'banned') throw new HttpError(400, 'This student is no longer active.');

  let kind = 'text';
  let body = String(req.body.body || '').trim().slice(0, MAX_LEN);
  if (req.body.kind === 'meetup') {
    const spot = req.school.meetup_spots.find((s) => s.name === req.body.spot);
    if (!spot) throw new HttpError(400, 'Pick one of the campus meetup spots.');
    kind = 'meetup';
    body = JSON.stringify({ name: spot.name, description: spot.description || '', when: String(req.body.when || '').slice(0, 80) });
  }
  if (!body) throw new HttpError(400, 'Message is empty.');
  const msg = await addMessage(c, req.user.id, body, kind);
  res.status(201).json({
    message: { id: msg.id, kind, body, from_me: true, created_at: msg.created_at },
    contact_warning: kind === 'text' && containsContactInfo(body),
  });
}));

module.exports = router;
