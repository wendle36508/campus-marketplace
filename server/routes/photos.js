// Photo uploads, stored in the database so they survive restarts and redeploys
// (free hosting tiers have no permanent disk). Photos are resized on the phone
// before upload, so each one is typically 150-400 KB.
// Only signed-in, verified students can view photos.
const express = require('express');
const multer = require('multer');
const { db, newId, now } = require('../db');
const { HttpError, wrap, requireUser } = require('../lib');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(TYPES[file.mimetype] ? null : new HttpError(400, 'Please upload a JPG, PNG or WebP photo.'), !!TYPES[file.mimetype]),
});

// "/uploads/<id>.jpg" -> "<id>"
function photoIdFromUrl(url) {
  const m = /^\/uploads\/([A-Za-z0-9_-]+)\.(jpg|png|webp|gif)$/.exec(String(url || ''));
  return m ? m[1] : null;
}

async function getPhoto(url) {
  const id = photoIdFromUrl(url);
  return id ? db('photos').where({ id }).first() : null;
}

async function photoExists(url) {
  const id = photoIdFromUrl(url);
  if (!id) return false;
  return !!(await db('photos').select('id').where({ id }).first());
}

// Photos are either uploads or the bundled demo images.
async function validPhoto(url) {
  return /^\/img\/seed\/[a-z0-9-]+\.svg$/.test(String(url)) || photoExists(url);
}

const api = express.Router();
api.post('/uploads', requireUser, upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No photo received.');
  const id = newId();
  await db('photos').insert({
    id,
    uploader_id: req.user.id,
    mime: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer,
    created_at: now(),
  });
  res.json({ url: `/uploads/${id}.${TYPES[req.file.mimetype]}` });
}));

const serve = express.Router();
serve.get('/uploads/:name', requireUser, wrap(async (req, res) => {
  const photo = await getPhoto(`/uploads/${req.params.name}`);
  if (!photo) return res.status(404).end();
  res.set('Content-Type', photo.mime);
  res.set('Cache-Control', 'private, max-age=604800, immutable');
  res.send(Buffer.from(photo.data));
}));

module.exports = { api, serve, getPhoto, validPhoto };
