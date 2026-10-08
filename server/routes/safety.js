// Reports, blocks, and the admin moderation tools.
const express = require('express');
const { db, newId, now } = require('../db');
const { REPORT_REASONS } = require('../constants');
const { HttpError, wrap, requireMember, requireAdmin, hydrateListings, publicUser, userStats } = require('../lib');

// ---- reports + blocks (any member) -----------------------------------------
const safety = express.Router();
safety.use(requireMember);

safety.post('/reports', wrap(async (req, res) => {
  const reason = String(req.body.reason || '');
  if (!REPORT_REASONS.some((r) => r.id === reason)) throw new HttpError(400, 'Pick a reason.');
  const listingId = req.body.listing_id ? String(req.body.listing_id) : null;
  let userId = req.body.user_id ? String(req.body.user_id) : null;
  if (!listingId && !userId) throw new HttpError(400, 'Nothing to report.');

  if (listingId) {
    const l = await db('listings').where({ id: listingId, school_id: req.user.school_id }).first();
    if (!l) throw new HttpError(404, 'Listing not found.');
    userId = userId || l.seller_id;
  }
  if (userId) {
    const u = await db('users').where({ id: userId, school_id: req.user.school_id }).first();
    if (!u) throw new HttpError(404, 'Student not found.');
  }
  if (userId === req.user.id) throw new HttpError(400, 'You can\'t report yourself.');

  await db('reports').insert({
    id: newId(),
    school_id: req.user.school_id,
    reporter_id: req.user.id,
    listing_id: listingId,
    reported_user_id: userId,
    reason,
    details: String(req.body.details || '').trim().slice(0, 1000) || null,
    status: 'open',
    created_at: now(),
  });
  res.status(201).json({ ok: true });
}));

safety.post('/blocks', wrap(async (req, res) => {
  const id = String(req.body.user_id || '');
  if (!id || id === req.user.id) throw new HttpError(400, 'Invalid user.');
  const u = await db('users').where({ id, school_id: req.user.school_id }).first();
  if (!u) throw new HttpError(404, 'Student not found.');
  const exists = await db('blocks').where({ blocker_id: req.user.id, blocked_id: id }).first();
  if (!exists) await db('blocks').insert({ blocker_id: req.user.id, blocked_id: id, created_at: now() });
  res.json({ ok: true });
}));

safety.delete('/blocks/:userId', wrap(async (req, res) => {
  await db('blocks').where({ blocker_id: req.user.id, blocked_id: req.params.userId }).del();
  res.json({ ok: true });
}));

safety.get('/blocks', wrap(async (req, res) => {
  const rows = await db('blocks').where({ blocker_id: req.user.id });
  const users = await db('users').whereIn('id', rows.map((r) => r.blocked_id));
  res.json({ users: users.map((u) => publicUser(u, req.school)) });
}));

// ---- admin (scoped to the admin's own school) -------------------------------
const admin = express.Router();
admin.use(requireAdmin);

admin.get('/summary', wrap(async (req, res) => {
  const sid = req.user.school_id;
  const count = async (q) => Number((await q.count({ n: '*' }).first()).n);
  res.json({
    open_reports: await count(db('reports').where({ school_id: sid, status: 'open' })),
    flagged_listings: await count(db('listings').where({ school_id: sid, moderation: 'flagged' }).whereNot('status', 'removed')),
    active_listings: await count(db('listings').where({ school_id: sid, status: 'active' }).whereNot('moderation', 'flagged')),
    students: await count(db('users').where({ school_id: sid }).whereNotNull('first_name')),
    banned: await count(db('users').where({ school_id: sid, status: 'banned' })),
  });
}));

admin.get('/reports', wrap(async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const reports = await db('reports').where({ school_id: req.user.school_id, status }).orderBy('created_at', 'desc').limit(200);
  const userIds = reports.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean);
  const users = Object.fromEntries((await db('users').whereIn('id', userIds)).map((u) => [u.id, u]));
  const stats = await userStats(userIds);
  const listingRows = await db('listings').whereIn('id', reports.map((r) => r.listing_id).filter(Boolean));
  const listings = Object.fromEntries((await hydrateListings(listingRows, req.school, req.user)).map((l) => [l.id, l]));
  const reasonLabel = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));
  // admins can see emails so they can follow up
  const withEmail = (u) => (u ? { ...publicUser(u, req.school, stats), email: u.email, status: u.status } : null);
  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      reason_label: reasonLabel[r.reason] || r.reason,
      details: r.details,
      status: r.status,
      created_at: r.created_at,
      reporter: withEmail(users[r.reporter_id]),
      reported_user: withEmail(users[r.reported_user_id]),
      listing: r.listing_id ? listings[r.listing_id] || null : null,
    })),
  });
}));

admin.post('/reports/:id', wrap(async (req, res) => {
  const status = req.body.status;
  if (!['resolved', 'dismissed', 'open'].includes(status)) throw new HttpError(400, 'Invalid status.');
  const n = await db('reports').where({ id: req.params.id, school_id: req.user.school_id }).update({ status, resolved_by: req.user.id });
  if (!n) throw new HttpError(404, 'Report not found.');
  res.json({ ok: true });
}));

admin.get('/flagged', wrap(async (req, res) => {
  const rows = await db('listings').where({ school_id: req.user.school_id, moderation: 'flagged' }).whereNot('status', 'removed').orderBy('created_at', 'desc');
  res.json({ listings: await hydrateListings(rows, req.school, req.user) });
}));

admin.post('/listings/:id/remove', wrap(async (req, res) => {
  const n = await db('listings').where({ id: req.params.id, school_id: req.user.school_id }).update({ status: 'removed', updated_at: now() });
  if (!n) throw new HttpError(404, 'Listing not found.');
  await db('reports').where({ listing_id: req.params.id, status: 'open' }).update({ status: 'resolved', resolved_by: req.user.id });
  res.json({ ok: true });
}));

admin.post('/listings/:id/approve', wrap(async (req, res) => {
  const n = await db('listings').where({ id: req.params.id, school_id: req.user.school_id }).update({ moderation: 'approved', updated_at: now() });
  if (!n) throw new HttpError(404, 'Listing not found.');
  res.json({ ok: true });
}));

admin.get('/users', wrap(async (req, res) => {
  let q = db('users').where({ school_id: req.user.school_id }).orderBy('created_at', 'desc').limit(200);
  const term = String(req.query.q || '').trim().toLowerCase();
  if (term) q = q.where((b) => b.whereRaw('lower(email) like ?', [`%${term}%`]).orWhereRaw('lower(first_name) like ?', [`%${term}%`]));
  const users = await q;
  const stats = await userStats(users.map((u) => u.id));
  const reportCounts = await db('reports').select('reported_user_id').count({ n: '*' }).whereIn('reported_user_id', users.map((u) => u.id)).groupBy('reported_user_id');
  const rc = Object.fromEntries(reportCounts.map((r) => [r.reported_user_id, Number(r.n)]));
  res.json({
    users: users.map((u) => ({ ...publicUser(u, req.school, stats), email: u.email, role: u.role, status: u.status, ban_reason: u.ban_reason, report_count: rc[u.id] || 0 })),
  });
}));

admin.post('/users/:id/ban', wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You can\'t ban yourself.');
  const u = await db('users').where({ id: req.params.id, school_id: req.user.school_id }).first();
  if (!u) throw new HttpError(404, 'Student not found.');
  await db('users').where({ id: u.id }).update({ status: 'banned', ban_reason: String(req.body.reason || '').slice(0, 300) || null });
  await db('sessions').where({ user_id: u.id }).del(); // sign them out everywhere
  await db('reports').where({ reported_user_id: u.id, status: 'open' }).update({ status: 'resolved', resolved_by: req.user.id });
  res.json({ ok: true });
}));

admin.post('/users/:id/unban', wrap(async (req, res) => {
  const n = await db('users').where({ id: req.params.id, school_id: req.user.school_id }).update({ status: 'active', ban_reason: null });
  if (!n) throw new HttpError(404, 'Student not found.');
  res.json({ ok: true });
}));

module.exports = { safety, admin };
