// Legal pages and the agreement students must accept before using the app.
const express = require('express');
const { db, newId, now } = require('../db');
const { HttpError, wrap, requireUser, activeSchools } = require('../lib');
const { META, AGE_CHOICES, renderDoc } = require('../legal');

async function hasAgreed(userId) {
  return !!(await db('agreements').where({ user_id: userId, version: META.version }).first());
}

// Readable by anyone, signed in or not.
const pages = express.Router();
pages.get('/:doc', wrap(async (req, res) => {
  const school = req.school || (await activeSchools())[0] || null;
  const doc = renderDoc(req.params.doc, school);
  if (!doc) throw new HttpError(404, 'Page not found.');
  res.json(doc);
}));

const agreement = express.Router();
agreement.post('/', requireUser, wrap(async (req, res) => {
  const { agree, current_student: student, age_choice: age } = req.body || {};
  if (agree !== true) throw new HttpError(400, 'Please tick the box to agree.');
  if (student !== true) throw new HttpError(400, 'Please confirm you\'re a current student.');
  if (!AGE_CHOICES.includes(age)) throw new HttpError(400, 'Please choose your age.');
  if (!(await hasAgreed(req.user.id))) {
    await db('agreements').insert({
      id: newId(), user_id: req.user.id, version: META.version,
      current_student: true, age_choice: age, agreed_at: now(),
    });
  }
  res.json({ ok: true });
}));

// Until a signed-in student agrees to the current version, the API only
// answers the calls needed to read the pages, agree, or sign out.
const OPEN = [/^\/config$/, /^\/me\/agreement\/?$/, /^\/legal\//, /^\/auth\//];
async function requireAgreement(req, _res, next) {
  try {
    if (!req.user || OPEN.some((re) => re.test(req.path))) return next();
    if (req.method === 'GET' && /^\/me\/?$/.test(req.path)) return next();
    if (await hasAgreed(req.user.id)) return next();
    next(new HttpError(403, 'Please agree to the Terms to keep using the app.', 'agreement_required'));
  } catch (err) { next(err); }
}

module.exports = { pages, agreement, requireAgreement, hasAgreed };
