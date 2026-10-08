// My profile, other students' profiles, and the Safety Center.
import { get } from '../api.js';
import { html, icon, render, avatar, verifiedBadge, listingTile, money, $, $$ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell, navigate } from '../app.js';
import { logout } from './auth.js';
import { moreMenu, unblockUser } from './safety-actions.js';

function header(u, school) {
  return html`
    <div class="profile-head">
      ${avatar(u, 'lg')}
      <h2>${u.display_name}</h2>
      ${verifiedBadge(school.short_name)}
      <p class="small muted">Class of ${u.grad_year}</p>
    </div>
    <div class="card stats">
      <div><b>👍 ${u.rating.up}</b><span>Thumbs up</span></div>
      <div><b>${u.sold_count}</b><span>Items sold</span></div>
      <div><b>${new Date(u.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</b><span>Joined</span></div>
    </div>`;
}

export async function me() {
  const school = state.config.school;
  const u = state.me;
  const { listings } = await get('/my/listings');
  const el = mount(shell({
    active: 'profile',
    body: html`
      <div class="stack loose">
        ${header(u, school)}
        <div class="stack">
          <div class="row between"><h2>My listings</h2><a class="btn soft sm" href="#/sell">${icon('plus')}New</a></div>
          <div class="tabs" id="tabs"><button class="on" data-t="live">Active</button><button data-t="sold">Sold</button></div>
          <div id="mine"></div>
        </div>
        <div class="list">
          <a class="list-item" href="#/profile/edit">${icon('edit')}<span>Edit profile</span>${icon('chev', 'chev')}</a>
          <a class="list-item" href="#/safety">${icon('shield')}<span>Safety center</span>${icon('chev', 'chev')}</a>
          ${u.role === 'admin' ? html`<a class="list-item" href="#/admin">${icon('admin')}<span>Admin dashboard</span>${icon('chev', 'chev')}</a>` : ''}
          <button class="list-item" id="logout">${icon('logout')}<span>Sign out</span></button>
        </div>
        <p class="tiny faint center">Signed in as ${u.email} (only you can see this)</p>
      </div>`,
  }));

  const paint = (tab) => {
    const list = listings.filter((l) => (tab === 'sold' ? l.status === 'sold' : l.status !== 'sold'));
    render($('#mine', el), list.length
      ? html`<div class="card" style="padding:4px 14px">${list.map((l) => html`
          <a class="mini-row" href="#/listing/${l.id}">
            <img src="${l.photos[0] || ''}" alt="">
            <div class="grow" style="min-width:0"><div class="bold ellipsis">${l.title}</div>
              <div class="small muted">${money(l.price)} ${l.status === 'pending' ? html`· <span class="pill pending">Pending</span>` : ''} ${l.moderation === 'flagged' ? html`· <span class="pill flagged">In review</span>` : ''}</div></div>
            ${icon('chev', 'chev')}
          </a>`)}</div>`
      : html`<div class="empty" style="padding:24px"><p class="small">${tab === 'sold' ? 'Nothing sold yet.' : 'You have no active listings.'}</p></div>`);
  };
  paint('live');
  $('#tabs', el).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#tabs button', el).forEach((x) => x.classList.toggle('on', x === b));
    paint(b.dataset.t);
  };
  $('#logout', el).onclick = logout;
}

export async function user({ params: [id] }) {
  if (id === state.me.id) return navigate('/profile', { replace: true });
  const school = state.config.school;
  const { user: u, listings, blocked_by_me } = await get(`/users/${id}`);
  const el = mount(shell({
    title: u.display_name,
    back: true,
    active: 'home',
    actions: html`<button class="icon-btn" id="more" aria-label="More options">${icon('more')}</button>`,
    body: html`
      <div class="stack loose">
        ${header(u, school)}
        ${blocked_by_me ? html`<div class="notice warn">${icon('ban')}<span>You blocked ${u.first_name}. <button class="btn ghost sm" id="unblock">Unblock</button></span></div>` : ''}
        ${u.banned ? html`<div class="notice warn">${icon('ban')}<span>This account is no longer active.</span></div>` : ''}
        <h2>${u.first_name}'s listings</h2>
        ${listings.length ? html`<div class="grid">${listings.map((l) => listingTile(l, school.short_name))}</div>` : html`<p class="muted">No listings right now.</p>`}
      </div>`,
  }));
  $('#more', el).onclick = () => moreMenu({ user: u, onBlocked: () => navigate(`/u/${id}`, { replace: true }) });
  const ub = $('#unblock', el);
  if (ub) ub.onclick = () => unblockUser(u, () => navigate(`/u/${id}`, { replace: true }));
}

export async function safety() {
  const school = state.config.school;
  mount(shell({
    title: 'Safety center',
    back: true,
    active: 'profile',
    body: html`
      <div class="stack loose">
        <div class="trust-strip" style="align-items:flex-start">${icon('shield')}<span>Every member verified a <b>@${school.email_domains[0]}</b> email. Nobody outside ${school.name} can see your listings or message you.</span></div>
        <div class="stack">
          <h2>Safe meetup spots</h2>
          <div class="list">${school.meetup_spots.map((s) => html`<div class="list-item" style="cursor:default">${icon('pin')}<div><b>${s.name}</b><div class="small muted">${s.description || ''}</div></div></div>`)}</div>
        </div>
        <div class="stack">
          <h2>Tips</h2>
          <div class="card stack">${state.config.safety_tips.map((t) => html`<div class="row" style="align-items:flex-start">${icon('check')}<span>${t}</span></div>`)}</div>
        </div>
        <div class="stack">
          <h2>If something goes wrong</h2>
          <div class="card stack small">
            <p><b>Report</b> any listing or student from the ••• menu (scam, inappropriate, prohibited item, or no-show). Admins review every report.</p>
            <p><b>Block</b> someone to hide their listings and stop them from messaging you.</p>
            <p><b>Prohibited items</b> like weapons, alcohol, drugs and fake IDs are automatically flagged and hidden until reviewed.</p>
            <p>In an emergency, call campus public safety or 911.</p>
          </div>
        </div>
      </div>`,
  }));
}

