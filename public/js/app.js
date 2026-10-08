// App bootstrap: loads config + session, applies school branding, routes screens.
import { get } from './api.js';
import { html, raw, render, icon, escape } from './ui.js';
import { state } from './state.js';
import * as auth from './views/auth.js';
import * as feed from './views/feed.js';
import * as listing from './views/listing.js';
import * as sell from './views/sell.js';
import * as chat from './views/chat.js';
import * as profile from './views/profile.js';
import * as admin from './views/admin.js';

const routes = [
  { path: /^\/welcome$/, view: auth.welcome, public: true },
  { path: /^\/verify$/, view: auth.verify, public: true },
  { path: /^\/onboarding$/, view: auth.onboarding, needsProfile: false },
  { path: /^\/$/, view: feed.feed, nav: 'home' },
  { path: /^\/listing\/([\w-]+)$/, view: listing.detail, nav: 'home' },
  { path: /^\/listing\/([\w-]+)\/edit$/, view: sell.sell, nav: 'sell' },
  { path: /^\/sell$/, view: sell.sell, nav: 'sell' },
  { path: /^\/inbox$/, view: chat.inbox, nav: 'inbox' },
  { path: /^\/chat\/([\w-]+)$/, view: chat.conversation, nav: 'inbox' },
  { path: /^\/profile$/, view: profile.me, nav: 'profile' },
  { path: /^\/profile\/edit$/, view: auth.onboarding, nav: 'profile' },
  { path: /^\/u\/([\w-]+)$/, view: profile.user, nav: 'home' },
  { path: /^\/safety$/, view: profile.safety, nav: 'profile' },
  { path: /^\/admin$/, view: admin.admin, nav: 'profile', admin: true },
];

const appEl = document.getElementById('app');
let cleanup = null;
let unreadTimer = null;

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace || location.hash === target) route();
}

// Builds the standard page frame: top bar, content, bottom tab bar.
export function shell({ title, back, actions = '', nav = true, active = '', body, pageClass = '' }) {
  const school = state.config.school;
  const top = back
    ? html`<header class="topbar with-back">
        <button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>
        <div class="title">${title || ''}</div>${actions}</header>`
    : html`<header class="topbar">
        <div class="brandmark"><img src="/img/icon.svg" alt=""><span class="ellipsis">${state.config.app_name}</span></div>
        ${school ? html`<span class="school-chip">${school.short_name}</span>` : ''}${actions}</header>`;
  const tab = (id, href, label, ic) => html`<a href="${href}" class="${active === id ? 'active' : ''}">${icon(ic)}<span>${label}</span>${id === 'inbox' ? raw('<span class="nav-badge hidden" data-unread></span>') : ''}</a>`;
  const bottom = nav
    ? html`<nav class="bottom-nav">
        ${tab('home', '#/', 'Browse', 'home')}
        <a href="#/sell" class="sell-btn ${active === 'sell' ? 'active' : ''}"><span class="plus">${icon('plus')}</span><span>Sell</span></a>
        ${tab('inbox', '#/inbox', 'Inbox', 'chat')}
        ${tab('profile', '#/profile', 'Profile', 'user')}
      </nav>`
    : '';
  return html`${top}<main class="page ${nav ? '' : 'no-nav'} ${pageClass}">${body}</main>${bottom}`;
}

export function mount(tpl) {
  render(appEl, tpl);
  window.scrollTo(0, 0);
  const backBtn = appEl.querySelector('[data-back]');
  if (backBtn) backBtn.onclick = () => (history.length > 1 ? history.back() : navigate('/'));
  paintUnread();
  return appEl;
}

function paintUnread() {
  const el = appEl.querySelector('[data-unread]');
  if (!el) return;
  el.textContent = state.unread > 9 ? '9+' : String(state.unread);
  el.classList.toggle('hidden', !state.unread);
}

export async function refreshUnread() {
  if (!state.me || !state.me.profile_complete) return;
  try {
    const { unread } = await get('/conversations/unread');
    state.unread = unread;
    paintUnread();
  } catch { /* ignore */ }
}

export async function refreshMe() {
  const { user } = await get('/me');
  state.me = user;
  if (user) {
    // the config's school follows the signed-in user's school
    state.config = await get('/config');
    applyBranding();
  }
  return user;
}

function applyBranding() {
  const s = state.config.school;
  const root = document.documentElement.style;
  if (s) {
    root.setProperty('--brand', s.primary_color);
    root.setProperty('--brand-dark', s.primary_color_dark || s.primary_color);
    document.querySelector('meta[name=theme-color]').setAttribute('content', s.primary_color);
  }
  document.title = state.config.app_name;
}

async function route() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  document.getElementById('sheet-root').innerHTML = '';
  document.body.style.overflow = '';

  const { path, query } = parseHash();
  const match = routes.map((r) => ({ r, m: path.match(r.path) })).find((x) => x.m);
  if (!match) return navigate('/', { replace: true });
  const { r, m } = match;

  const me = state.me;
  if (!r.public && !me) return navigate('/welcome', { replace: true });
  if (me && me.status === 'banned') return renderBanned();
  if (r.public && me && me.profile_complete) return navigate('/', { replace: true });
  if (me && !me.profile_complete && r.needsProfile !== false && !r.public) return navigate('/onboarding', { replace: true });
  if (r.admin && me.role !== 'admin') return navigate('/', { replace: true });

  try {
    const result = await r.view({ params: m.slice(1), query, nav: r.nav });
    if (typeof result === 'function') cleanup = result;
  } catch (err) {
    console.error(err);
    if (err.status === 401) { state.me = null; return navigate('/welcome', { replace: true }); }
    mount(shell({
      title: 'Oops', back: true, active: r.nav,
      body: html`<div class="empty"><div class="big">😕</div><p>${err.message || 'Something went wrong.'}</p><p style="margin-top:16px"><a class="btn secondary" href="#/">Back to listings</a></p></div>`,
    }));
  }
}

function renderBanned() {
  mount(html`<main class="page no-nav"><div class="empty"><div class="big">🚫</div><h2>Account suspended</h2>
    <p style="margin-top:8px">Your account was suspended for breaking the community guidelines. Contact campus support if you think this is a mistake.</p></div></main>`);
}

async function boot() {
  try {
    state.config = await get('/config');
    applyBranding();
    await refreshMe();
  } catch (err) {
    render(appEl, html`<div class="empty"><div class="big">📡</div><p>${escape(err.message)}</p></div>`);
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  refreshUnread();
  unreadTimer = setInterval(refreshUnread, 20000);
}

boot();
export { unreadTimer };
