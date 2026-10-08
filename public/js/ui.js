// Small UI toolkit: safe HTML templating, icons, toasts, bottom sheets, formatters.

// ---- templating -------------------------------------------------------------
// html`...` escapes every interpolated value unless it is itself an html`` result.
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const val = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join('') : v === false || v == null ? '' : escape(v));
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < values.length ? val(values[i]) : ''); });
  return new Safe(out);
}
export const raw = (s) => new Safe(String(s));
export function render(el, tpl) { el.innerHTML = String(tpl); return el; }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---- icons (inline SVG, stroke = currentColor) -----------------------------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  admin: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="M12 8v5M12 16h0"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export const icon = (name, cls = '') =>
  raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

// Filled check-badge used for the "Verified <School> Student" badge
const BADGE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.8l2.4 1.8 3-.2 1 2.8 2.6 1.6-.7 2.9 1.2 2.7-2.2 2-.3 3-2.9.7-1.7 2.5-2.8-1-2.8 1-1.7-2.5-2.9-.7-.3-3-2.2-2 1.2-2.7-.7-2.9L5.6 6.2l1-2.8 3 .2z"/><path d="m8 12.2 2.7 2.7L16.3 9.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function verifiedBadge(schoolShort, { iconOnly = false } = {}) {
  if (iconOnly) return raw(`<span class="verified icon-only" title="Verified ${escape(schoolShort)} Student">${BADGE}</span>`);
  return raw(`<span class="verified">${BADGE}Verified ${escape(schoolShort)} Student</span>`);
}

// ---- formatters -------------------------------------------------------------
export function money(n) {
  if (!n) return 'Free';
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 2 : 0, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
}
export function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function clockTime(iso) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return today ? t : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${t}`;
}
export function avatar(user, size = '') {
  if (!user) return raw(`<div class="avatar ${size}">?</div>`);
  if (user.photo_url) return html`<div class="avatar ${size}"><img src="${user.photo_url}" alt=""></div>`;
  return html`<div class="avatar ${size}">${(user.first_name || '?').charAt(0)}</div>`;
}

// ---- toast ------------------------------------------------------------------
let toastTimer;
export function toast(message, { error = false, ms = 2600 } = {}) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---- bottom sheet -----------------------------------------------------------
// openSheet(tpl, onMount) -> { el, close }. Tapping the backdrop closes it.
export function openSheet(tpl, onMount) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${tpl}</div>`;
  root.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const close = () => {
    wrap.remove();
    if (!root.children.length) document.body.style.overflow = '';
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  const sheet = wrap.querySelector('.sheet');
  if (onMount) onMount(sheet, close);
  return { el: sheet, close };
}

export function confirmSheet({ title, body = '', confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const { close } = openSheet(String(html`
      <h2>${title}</h2>
      ${body ? html`<p class="muted" style="margin-bottom:16px">${body}</p>` : ''}
      <div class="stack">
        <button class="btn block ${danger ? 'danger' : ''}" data-yes>${confirm}</button>
        <button class="btn block secondary" data-close>Cancel</button>
      </div>`), (el, closeFn) => {
      el.querySelector('[data-yes]').onclick = () => { done = true; closeFn(); resolve(true); };
    });
    // resolve(false) when dismissed
    const obs = new MutationObserver(() => {
      if (!document.getElementById('sheet-root').contains(document.querySelector('[data-yes]'))) {
        obs.disconnect();
        if (!done) resolve(false);
      }
    });
    obs.observe(document.getElementById('sheet-root'), { childList: true });
    return close;
  });
}

export function spinnerBtn(btn, on, label) {
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${label ? escape(label) : ''}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

// ---- shared listing tile ----------------------------------------------------
export function listingTile(l, schoolShort) {
  const statusPill = l.status === 'pending' ? html`<span class="pill pending">Pending</span>` : l.status === 'sold' ? html`<span class="pill sold">Sold</span>` : '';
  return html`
    <a class="tile" href="#/listing/${l.id}">
      <div class="ph">
        <img src="${l.photos[0] || ''}" alt="" loading="lazy">
        <div class="tags">
          ${l.move_out_sale ? html`<span class="pill moveout">Move-Out</span>` : ''}
          ${statusPill}
          ${l.moderation === 'flagged' ? html`<span class="pill flagged">In review</span>` : ''}
        </div>
      </div>
      <div class="body">
        <div class="price">${money(l.price)}</div>
        <div class="t">${l.title}</div>
        <div class="meta">${l.condition} · ${timeAgo(l.created_at)}</div>
        <div class="seller">${l.seller.first_name} ${verifiedBadge(schoolShort, { iconOnly: true })}</div>
      </div>
    </a>`;
}
