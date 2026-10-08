// Admin dashboard: reports, auto-flagged listings, users (ban/unban).
import { get, post } from '../api.js';
import { html, icon, render, money, timeAgo, avatar, toast, confirmSheet, openSheet, $, $$ } from '../ui.js';
import { mount, shell } from '../app.js';

export async function admin({ query }) {
  let tab = query.tab || 'reports';
  const el = mount(shell({
    title: 'Admin',
    back: true,
    active: 'profile',
    body: html`
      <div class="stack loose">
        <div class="admin-stats" id="stats"></div>
        <div class="tabs" id="tabs">
          <button data-t="reports">Reports</button><button data-t="flagged">Flagged</button><button data-t="users">Users</button>
        </div>
        <div id="panel"></div>
      </div>`,
  }));

  async function loadStats() {
    const s = await get('/admin/summary');
    render($('#stats', el), html`
      <div class="card"><b style="color:var(--danger)">${s.open_reports}</b><span>Open reports</span></div>
      <div class="card"><b style="color:var(--warn)">${s.flagged_listings}</b><span>Flagged</span></div>
      <div class="card"><b>${s.students}</b><span>Students</span></div>`);
  }

  const panel = $('#panel', el);
  const userLine = (u) => (u ? html`${u.display_name} <span class="faint">(${u.email})</span>` : html`<span class="faint">unknown</span>`);

  async function showReports() {
    const { reports } = await get('/admin/reports?status=open');
    render(panel, reports.length ? html`<div class="stack">${reports.map((r) => html`
      <div class="card report-card stack tight" data-id="${r.id}">
        <div class="row between"><span class="pill flagged">${r.reason_label}</span><span class="tiny faint">${timeAgo(r.created_at)}</span></div>
        ${r.listing ? html`<a class="mini-row" href="#/listing/${r.listing.id}"><img src="${r.listing.photos[0] || ''}" alt=""><div class="grow"><b>${r.listing.title}</b><div class="small muted">${money(r.listing.price)} · ${r.listing.status}</div></div></a>` : ''}
        <p class="small"><b>Reported:</b> ${userLine(r.reported_user)} ${r.reported_user && r.reported_user.status === 'banned' ? html`<span class="pill flagged">banned</span>` : ''}</p>
        <p class="small"><b>By:</b> ${userLine(r.reporter)}</p>
        ${r.details ? html`<p class="small" style="background:#f6f7f6;padding:8px 10px;border-radius:8px">“${r.details}”</p>` : ''}
        <div class="row wrap" style="margin-top:6px">
          ${r.listing && r.listing.status !== 'removed' ? html`<button class="btn sm danger-soft" data-act="remove" data-listing="${r.listing.id}">Remove listing</button>` : ''}
          ${r.reported_user && r.reported_user.status !== 'banned' ? html`<button class="btn sm danger" data-act="ban" data-user="${r.reported_user.id}" data-name="${r.reported_user.display_name}">Ban user</button>` : ''}
          <button class="btn sm secondary" data-act="dismiss">Dismiss</button>
          <button class="btn sm soft" data-act="resolve">Mark resolved</button>
        </div>
      </div>`)}</div>` : html`<div class="empty"><div class="big">✅</div><p>No open reports.</p></div>`);
  }

  async function showFlagged() {
    const { listings } = await get('/admin/flagged');
    render(panel, listings.length ? html`<div class="stack">
      <p class="small muted">These listings matched the prohibited-items filter and are hidden from the feed until you approve or remove them.</p>
      ${listings.map((l) => html`
      <div class="card stack tight">
        <a class="mini-row" href="#/listing/${l.id}"><img src="${l.photos[0] || ''}" alt=""><div class="grow"><b>${l.title}</b><div class="small muted">${money(l.price)} · by ${l.seller.display_name} · ${timeAgo(l.created_at)}</div></div></a>
        <p class="small"><span class="pill flagged">${l.moderation_reasons.join(', ') || 'Flagged'}</span> ${l.description || ''}</p>
        <div class="row"><button class="btn sm soft grow" data-act="approve" data-listing="${l.id}">Approve</button><button class="btn sm danger-soft grow" data-act="remove" data-listing="${l.id}">Remove</button></div>
      </div>`)}</div>` : html`<div class="empty"><div class="big">✅</div><p>Nothing flagged.</p></div>`);
  }

  async function showUsers(q = '') {
    const { users } = await get(`/admin/users?q=${encodeURIComponent(q)}`);
    render(panel, html`
      <div class="stack">
        <input class="input" id="uq" type="search" placeholder="Search name or email" value="${q}">
        <div class="list">${users.map((u) => html`
          <div class="list-item" style="cursor:default">
            ${avatar(u, 'sm')}
            <div class="grow" style="min-width:0"><div class="bold ellipsis">${u.first_name ? u.display_name : '(no profile yet)'} ${u.role === 'admin' ? html`<span class="pill">admin</span>` : ''}</div>
              <div class="tiny muted ellipsis">${u.email} · 👍 ${u.rating.up} 👎 ${u.rating.down}${u.report_count ? ` · ${u.report_count} report${u.report_count > 1 ? 's' : ''}` : ''}</div></div>
            ${u.role === 'admin' ? '' : u.status === 'banned'
              ? html`<button class="btn sm secondary" data-act="unban" data-user="${u.id}">Unban</button>`
              : html`<button class="btn sm danger-soft" data-act="ban" data-user="${u.id}" data-name="${u.display_name}">Ban</button>`}
          </div>`)}</div>
      </div>`);
    let t;
    const uq = $('#uq', el);
    uq.oninput = () => { clearTimeout(t); t = setTimeout(async () => { await showUsers(uq.value.trim()); const n = $('#uq', el); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
  }

  async function show() {
    $$('#tabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    render(panel, html`<div class="center" style="padding:32px"><span class="spinner" style="display:inline-block"></span></div>`);
    await loadStats();
    if (tab === 'reports') await showReports();
    if (tab === 'flagged') await showFlagged();
    if (tab === 'users') await showUsers();
  }

  $('#tabs', el).onclick = (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; history.replaceState(null, '', `#/admin?tab=${tab}`); show(); } };

  panel.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const card = b.closest('[data-id]');
    const act = b.dataset.act;
    try {
      if (act === 'remove') {
        if (!(await confirmSheet({ title: 'Remove this listing?', body: 'It disappears from the marketplace for everyone.', confirm: 'Remove', danger: true }))) return;
        await post(`/admin/listings/${b.dataset.listing}/remove`);
        toast('Listing removed');
      } else if (act === 'approve') {
        await post(`/admin/listings/${b.dataset.listing}/approve`);
        toast('Listing approved and visible');
      } else if (act === 'ban') {
        const reason = await banReason(b.dataset.name);
        if (reason === null) return;
        await post(`/admin/users/${b.dataset.user}/ban`, { reason });
        toast(`${b.dataset.name} is banned`);
      } else if (act === 'unban') {
        await post(`/admin/users/${b.dataset.user}/unban`);
        toast('User unbanned');
      } else if (act === 'dismiss' || act === 'resolve') {
        await post(`/admin/reports/${card.dataset.id}`, { status: act === 'dismiss' ? 'dismissed' : 'resolved' });
        toast(act === 'dismiss' ? 'Report dismissed' : 'Report resolved');
      }
      show();
    } catch (err) { toast(err.message, { error: true }); }
  };

  await show();
}

function banReason(name) {
  return new Promise((resolve) => {
    let done = false;
    openSheet(String(html`
      <h2>Ban ${name}?</h2>
      <p class="muted small" style="margin-bottom:12px">They'll be signed out, their listings hidden, and they won't be able to sign back in.</p>
      <div class="field"><label for="reason">Reason (internal)</label><input class="input" id="reason" placeholder="e.g. Scam attempt, multiple reports"></div>
      <div class="stack" style="margin-top:14px"><button class="btn block danger" id="go">${icon('ban')}Ban user</button><button class="btn block secondary" data-close>Cancel</button></div>`), (el, close) => {
      $('#go', el).onclick = () => { done = true; const v = $('#reason', el).value.trim(); close(); resolve(v); };
      const root = document.getElementById('sheet-root');
      const obs = new MutationObserver(() => { if (!root.contains(el)) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(root, { childList: true });
    });
  });
}
