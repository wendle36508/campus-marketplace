// Inbox + one conversation (polls for new messages every few seconds).
import { get, post, patch } from '../api.js';
import { html, icon, money, timeAgo, clockTime, avatar, verifiedBadge, toast, openSheet, $ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell, navigate, refreshUnread } from '../app.js';
import { moreMenu, unblockUser } from './safety-actions.js';

const POLL_MS = 3000;

export async function inbox() {
  const { conversations } = await get('/conversations');
  const school = state.config.school;
  const preview = (c) => {
    const m = c.last_message;
    if (m.kind === 'meetup') { try { return `📍 Meetup: ${JSON.parse(m.body).name}`; } catch { return '📍 Meetup spot'; } }
    return (m.from_me ? 'You: ' : '') + m.body;
  };
  mount(shell({
    active: 'inbox',
    body: html`
      <h1 style="margin:4px 0 14px">Inbox</h1>
      ${conversations.length
        ? html`<div class="list">${conversations.map((c) => html`
          <a class="convo ${c.unread ? 'unread' : ''}" href="#/chat/${c.id}">
            <img class="thumb-sm" src="${c.listing ? c.listing.photo : ''}" alt="">
            <div class="grow stack" style="gap:2px">
              <div class="row between"><b class="ellipsis">${c.other.display_name}</b><span class="tiny faint" style="flex:none">${timeAgo(c.last_message.created_at)}</span></div>
              <div class="small muted ellipsis">${c.role === 'buyer' ? 'Buying' : 'Selling'} · ${c.listing ? c.listing.title : ''}</div>
              <div class="small muted ellipsis last">${preview(c)}</div>
            </div>
            ${c.unread ? html`<span class="unread-dot"></span>` : ''}
          </a>`)}</div>`
        : html`<div class="empty"><div class="big">💬</div><p><b>No messages yet</b></p><p class="small" style="margin-top:4px">When you message a seller or someone asks about your listing, it shows up here. Everyone you chat with is a verified ${school.short_name} student.</p><p style="margin-top:16px"><a class="btn soft" href="#/">Browse listings</a></p></div>`}`,
  }));
  refreshUnread();
}

function messageNode(m) {
  if (m.kind === 'system') return html`<div class="sys-msg">${m.body}</div>`;
  if (m.kind === 'meetup') {
    let spot = {};
    try { spot = JSON.parse(m.body); } catch { /* ignore */ }
    return html`<div class="meetup-card ${m.from_me ? 'me' : 'them'}">
      <div class="top">${icon('shield')}Suggested safe meetup spot</div>
      <div class="bd"><b>📍 ${spot.name}</b>${spot.when ? html`<div class="small">🕑 ${spot.when}</div>` : ''}${spot.description ? html`<div class="small muted">${spot.description}</div>` : ''}</div>
    </div>`;
  }
  return html`<div class="bubble ${m.from_me ? 'me' : 'them'}">${m.body}</div>`;
}

function renderMessages(list) {
  let out = '';
  let lastTime = 0;
  for (const m of list) {
    const t = new Date(m.created_at).getTime();
    if (t - lastTime > 15 * 60e3) out += String(html`<div class="msg-time" style="align-self:center">${clockTime(m.created_at)}</div>`);
    lastTime = t;
    out += String(messageNode(m));
  }
  return out;
}

export async function conversation({ params: [id] }) {
  const data = await get(`/conversations/${id}`);
  const school = state.config.school;
  let { conversation: c, messages, meetup_spots: spots } = data;
  const isSeller = c.role === 'seller';
  const showTips = !state.me.safety_tips_seen;

  const el = mount(html`
    <div class="chat-page">
      <header class="topbar with-back">
        <button class="icon-btn" data-back aria-label="Back">${icon('back')}</button>
        <a href="#/u/${c.other.id}" class="row grow" style="color:inherit;gap:10px;min-width:0">${avatar(c.other, 'sm')}
          <div style="min-width:0"><div class="bold ellipsis" style="font-size:16px">${c.other.display_name}</div><div class="tiny" style="color:var(--brand);font-weight:650">✓ Verified ${school.short_name} Student</div></div></a>
        <button class="icon-btn" id="more" aria-label="More options">${icon('more')}</button>
      </header>
      <a class="chat-listing" href="#/listing/${c.listing.id}">
        <img src="${c.listing.photo || ''}" alt="">
        <div class="grow" style="min-width:0"><div class="bold ellipsis">${c.listing.title}</div><div class="small muted">${money(c.listing.price)} ${c.listing.status !== 'active' ? html`· <span class="pill ${c.listing.status}">${c.listing.status}</span>` : ''}</div></div>
        ${icon('chev', 'chev')}
      </a>
      ${showTips ? html`<div class="safety-banner" id="tips">
        <div class="row">${icon('shield')}<b>Stay safe when you meet up</b></div>
        <ul>${state.config.safety_tips.slice(0, 4).map((t) => html`<li>${t}</li>`)}</ul>
        <button class="btn sm soft" id="tips-ok">Got it</button>
      </div>` : ''}
      <div class="chat-scroll" id="scroll">${messages.length ? '' : html`<div class="sys-msg">Say hi! Keep the chat here so you never need to share your number.</div>`}</div>
      <div class="composer">
        ${c.blocked
          ? html`<div class="notice warn">${icon('ban')}<span>You blocked ${c.other.first_name}. <button class="btn ghost sm" id="unblock">Unblock</button></span></div>`
          : c.other.banned ? html`<div class="notice warn">${icon('ban')}<span>This student is no longer active.</span></div>`
          : html`
          <div class="quick">
            <button type="button" class="chip" id="spot">${icon('pin')}Suggest safe spot</button>
            ${isSeller && c.listing.status === 'active' ? html`<button type="button" class="chip" data-status="pending">Mark pending</button>` : ''}
            ${isSeller && c.listing.status !== 'sold' ? html`<button type="button" class="chip" data-status="sold">Mark sold to ${c.other.first_name}</button>` : ''}
            ${isSeller && c.listing.status !== 'active' ? html`<button type="button" class="chip" data-status="active">Mark available</button>` : ''}
            ${!isSeller && !messages.length ? html`<button type="button" class="chip" data-quick="Hi! Is this still available?">Is this still available?</button>` : ''}
            ${!isSeller ? html`<button type="button" class="chip" data-quick="When could we meet?">When could we meet?</button>` : ''}
          </div>
          <form id="send-form"><textarea id="body" rows="1" placeholder="Message" maxlength="1000" enterkeyhint="send"></textarea><button class="send" aria-label="Send">${icon('send')}</button></form>`}
      </div>
    </div>`);

  const rerender = () => navigate(`/chat/${id}`, { replace: true });
  const scroll = $('#scroll', el);
  let lastAt = messages.length ? messages[messages.length - 1].created_at : '';
  const seen = new Set(messages.map((m) => m.id));
  const paintRating = () => {
    const old = $('#rate-card', el);
    if (old) old.remove();
    if (c.rating && c.rating.can_rate) {
      scroll.insertAdjacentHTML('beforeend', String(html`<div class="card rate-card" id="rate-card"><b>How was your deal with ${c.other.first_name}?</b><p class="small muted">Your rating helps other ${school.short_name} students.</p><div class="rate-btns"><button data-v="1" aria-label="Thumbs up">👍</button><button data-v="-1" aria-label="Thumbs down">👎</button></div></div>`));
      $('#rate-card', el).onclick = async (e) => {
        const b = e.target.closest('button[data-v]'); if (!b) return;
        try {
          await post(`/listings/${c.listing.id}/rating`, { value: Number(b.dataset.v) });
          c.rating.can_rate = false;
          $('#rate-card', el).innerHTML = '<b>Thanks for rating! 🙌</b>';
        } catch (err) { toast(err.message, { error: true }); }
      };
    }
  };
  const toBottom = () => { scroll.scrollTop = scroll.scrollHeight; };
  scroll.insertAdjacentHTML('beforeend', renderMessages(messages));
  paintRating();
  toBottom();

  const append = (list) => {
    const fresh = list.filter((m) => !seen.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => seen.add(m.id));
    const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;
    const rc = $('#rate-card', el);
    if (rc) rc.remove();
    scroll.insertAdjacentHTML('beforeend', renderMessages(fresh));
    paintRating();
    lastAt = fresh[fresh.length - 1].created_at;
    if (nearBottom || fresh.some((m) => m.from_me)) toBottom();
  };

  // polling
  let stopped = false;
  const poll = async () => {
    if (stopped || document.hidden) return;
    try {
      const res = await get(`/conversations/${id}?after=${encodeURIComponent(lastAt)}`);
      const statusChanged = res.conversation.listing.status !== c.listing.status;
      append(res.messages);
      if (statusChanged || JSON.stringify(res.conversation.rating) !== JSON.stringify(c.rating)) {
        c = res.conversation;
        if (statusChanged) return rerender(); // re-render header/actions
        paintRating();
      }
    } catch { /* ignore transient errors */ }
  };
  const timer = setInterval(poll, POLL_MS);

  // send
  const form = $('#send-form', el);
  const send = async (payload) => {
    try {
      const res = await post(`/conversations/${id}/messages`, payload);
      append([res.message]);
      if (res.contact_warning) toast('Tip: no need to share your number or email. Keep the chat here.', { ms: 4500 });
    } catch (err) { toast(err.message, { error: true }); }
  };
  if (form) {
    const ta = $('#body', el);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`; };
    ta.oninput = grow;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) return;
      ta.value = '';
      grow();
      send({ body });
    };
    el.querySelector('.quick').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'spot') return spotSheet(spots, (spot, when) => send({ kind: 'meetup', spot, when }));
      if (b.dataset.quick) { send({ body: b.dataset.quick }); b.remove(); return; }
      if (b.dataset.status) {
        try {
          if (b.dataset.status === 'sold') {
            await patch(`/listings/${c.listing.id}`, { status: 'sold', sold_to_user_id: c.buyer_id });
            toast(`Marked sold to ${c.other.first_name} 🎉`);
          } else {
            await patch(`/listings/${c.listing.id}`, { status: b.dataset.status });
            toast(b.dataset.status === 'pending' ? 'Marked pending' : 'Marked available');
          }
          rerender();
        } catch (err) { toast(err.message, { error: true }); }
      }
    };
  }

  $('#more', el).onclick = () => moreMenu({ listing: isSeller ? null : { id: c.listing.id }, user: c.other, onBlocked: () => rerender() });
  const unblock = $('#unblock', el);
  if (unblock) unblock.onclick = () => unblockUser(c.other, () => rerender());
  const tipsOk = $('#tips-ok', el);
  if (tipsOk) tipsOk.onclick = async () => {
    $('#tips', el).remove();
    state.me.safety_tips_seen = true;
    try { await post('/me/safety-tips-seen'); } catch { /* ignore */ }
  };

  refreshUnread();
  return () => { stopped = true; clearInterval(timer); };
}

function spotSheet(spots, onPick) {
  openSheet(String(html`
    <h2>Suggest a safe meetup spot</h2>
    <p class="muted small" style="margin-bottom:12px">Public, well-lit spots on campus. Pick one and add a time.</p>
    <div class="list" style="box-shadow:none;border:1px solid var(--border)">
      ${spots.map((s, i) => html`<label class="list-item"><input type="radio" name="spot" value="${i}" ${i === 0 ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)"><div><b>${s.name}</b><div class="small muted">${s.description || ''}</div></div></label>`)}
    </div>
    <div class="field" style="margin-top:14px"><label for="when">When? <span class="faint">(optional)</span></label><input class="input" id="when" placeholder="e.g. Tomorrow 4pm" maxlength="80"></div>
    <button class="btn block" id="send-spot" style="margin-top:14px">${icon('send')}Send to chat</button>`), (el, close) => {
    $('#send-spot', el).onclick = () => {
      const i = Number(el.querySelector('input[name=spot]:checked').value);
      onPick(spots[i].name, $('#when', el).value.trim());
      close();
    };
  });
}

