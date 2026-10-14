// Terms, Privacy Policy and Community Guidelines. The Markdown lives in legal/;
// bump "version" in legal/legal.json to ask everyone to agree again.
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const config = require('./config');

const DIR = path.join(__dirname, '..', 'legal');
const META = JSON.parse(fs.readFileSync(path.join(DIR, 'legal.json'), 'utf8'));
const DOCS = {
  terms: { file: 'terms.md', title: 'Terms of Use' },
  privacy: { file: 'privacy.md', title: 'Privacy Policy' },
  guidelines: { file: 'community-guidelines.md', title: 'Community Guidelines' },
};
const AGE_CHOICES = ['18_plus', '17_with_parent'];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Production must name who runs the app and how to reach them.
function missingSettings() {
  const missing = [];
  if (!config.operatorName) missing.push('OPERATOR_NAME');
  if (!config.supportEmail) missing.push('SUPPORT_EMAIL');
  return missing;
}

const cache = new Map();
function renderDoc(key, school) {
  const doc = DOCS[key];
  if (!doc) return null;
  const cacheKey = `${key}:${school ? school.id : ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const values = {
    APP_NAME: config.appName,
    OPERATOR_NAME: config.operatorName || '[operator name not set]',
    SUPPORT_EMAIL: config.supportEmail || '[support email not set]',
    SCHOOL_NAME: school ? school.name : 'your school',
    LAST_UPDATED: META.last_updated,
    VERSION: META.version,
  };
  const md = fs.readFileSync(path.join(DIR, doc.file), 'utf8')
    .replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? escapeHtml(values[k]) : m));
  const out = { key, title: doc.title, version: META.version, html: marked.parse(md) };
  cache.set(cacheKey, out);
  return out;
}

module.exports = { META, DOCS, AGE_CHOICES, renderDoc, missingSettings };
