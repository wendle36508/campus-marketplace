// Listing detail: photos, details, seller card, message / quick "still available?".
import { get, post, patch, del } from '../api.js';
import { html, icon, money, timeAgo, avatar, verifiedBadge, toast, openSheet, confirmSheet, spinnerBtn, $, $$ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell, navigate } from '../app.js';
import { moreMenu } from './safety-actions.js';

export async function detail({ params: [id] }) {
  const { listing: l } = await get(`/listings/${id}`);
  const school = state.config.school;
  const spot = school.meetup_spots.find((s) => s.name === l.pickup_location);
  const statusPill = { pending: html`<span class="pill pending">Pending</span>`, sold: html`<span class="pill sold">Sold</span>`, removed: html`<span class="pill flagged">Removed</span>` }[l.status] || '';

  const ownerActions = html`
    <div class="card stack">
      <h3>Manage your listing</h3>
      ${l.moderation === 'flagged' ? html`<div class="notice warn">${icon('warn')}<span>This listing is hidden while an admin reviews it (possible ${l.moderation_reasons.join(', ').toLowerCase() || 'prohibited item'}). Edit the wording if this was a mistake.</span></div>` : ''}
      <div class="segmented" id="status">
        ${[['active', 'Available'], ['pending', 'Pending'], ['sold', 'Sold']].map(([v, lab]) => html`<button type="button" data-s="${v}" class="${l.status === v ? 'on' : ''}">${lab}</button>`)}
      </div>
      <div class="row">
        <a class="btn secondary sm grow" href="#/listing/${l.id}/edit">${icon('edit')}Edit</a>
        <button class="btn danger-soft sm grow" id="delete">${icon('trash')}Delete</button>
      </div>
    </div>`;

  const buyerActions = l.status === 'sold'
    ? ''
    : html`<div class="sticky-actions">
        ${l.conversation_id
          ? html`<a class="btn block" href="#/chat/${l.conversation_id}">${icon('chat')}Open chat</a>`
          : html`<button class="btn soft grow" id="quick">Is this still available?</button><button class="btn" id="message" aria-label="Message seller">${icon('chat')}</button>`}
      </div>`;

  const el = mount(shell({
    title: l.title,
    back: true,
    active: 'home',
    pageClass: 'flush',
    actions: l.is_mine ? '' : html`<button class="icon-btn" id="more" aria-label="More options">${icon('more')}</button>`,
    body: html`
      <div class="gallery">
        <div class="track" id="track">${l.photos.map((p) => html`<img src="${p}" alt="">`)}</div>
        ${l.photos.length > 1 ? html`<div class="dots">${l.photos.map((_, i) => html`<i class="${i === 0 ? 'on' : ''}"></i>`)}</div>` : ''}
      </div>
      <div class="stack loose" style="padding:16px 16px ${l.is_mine ? '0' : '80px'}">
        <div class="stack tight">
          <div class="row wrap">${l.move_out_sale ? html`<span class="pill moveout">📦 Move-Out Sale</span>` : ''}${statusPill}<span class="pill">${l.category}</span></div>
          <div class="detail-price">${money(l.price)}</div>
          <h2>${l.title}</h2>
          <p class="small muted">Posted ${timeAgo(l.created_at)}</p>
        </div>

        ${l.can_rate ? html`<div class="card stack" id="rate"><h3>How was buying from ${l.seller.first_name}?</h3><div class="rate-btns"><button data-v="1" aria-label="Thumbs up">👍</button><button data-v="-1" aria-label="Thumbs down">👎</button></div></div>` : ''}

        ${l.is_mine ? ownerActions : ''}

        <dl class="kv">
          <dt>Condition</dt><dd>${l.condition}</dd>
          <dt>Category</dt><dd>${l.category}</dd>
        </dl>
        ${l.description ? html`<p style="white-space:pre-wrap">${l.description}</p>` : ''}

        ${l.pickup_location ? html`<div class="safe-spot">${icon(spot ? 'shield' : 'pin')}<div><b>Pickup: ${l.pickup_location}</b><p class="small muted">${spot ? `Suggested safe meetup spot. ${spot.description || ''}` : 'Tip: meet at one of the campus safe spots instead.'}</p></div></div>` : ''}

        <a class="card row" href="#/u/${l.seller.id}" style="color:inherit">
          ${avatar(l.seller)}
          <div class="grow stack tight">
            <div class="row"><b>${l.seller.display_name}</b><span class="small muted">Class of ${l.seller.grad_year}</span></div>
            ${verifiedBadge(school.short_name)}
          </div>
          <div class="center small"><b style="font-size:16px">👍 ${l.seller.rating.up}</b><br><span class="muted tiny">${l.seller.sold_count} sold</span></div>
        </a>

        <div class="notice info">${icon('shield')}<span>Meet in a public spot on campus and inspect the item before paying. <a href="#/safety"><b>Safety tips</b></a></span></div>
      </div>
      ${l.is_mine ? '' : buyerActions}`,
  }));

  // gallery dots
  const track = $('#track', el);
  if (track && l.photos.length > 1) {
    track.onscroll = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      $$('.dots i', el).forEach((d, j) => d.classList.toggle('on', i === j));
    };
  }

  const startChat = async (message, btn) => {
    if (btn) spinnerBtn(btn, true);
    try {
      const { conversation_id } = await post(`/listings/${l.id}/conversations`, { message });
      navigate(`/chat/${conversation_id}`);
    } catch (err) {
      if (btn) spinnerBtn(btn, false);
      toast(err.message, { error: true });
    }
  };
  const quick = $('#quick', el);
  if (quick) quick.onclick = () => startChat('Hi! Is this still available?', quick);
  const msg = $('#message', el);
  if (msg) msg.onclick = () => startChat('', msg);
  const more = $('#more', el);
  if (more) more.onclick = () => moreMenu({ listing: l, user: l.seller, onBlocked: () => navigate('/', { replace: true }) });

  const rate = $('#rate', el);
  if (rate) rate.onclick = async (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    try {
      await post(`/listings/${l.id}/rating`, { value: Number(b.dataset.v) });
      rate.innerHTML = '<p class="center"><b>Thanks for rating!</b> It helps keep the marketplace trustworthy.</p>';
    } catch (err) { toast(err.message, { error: true }); }
  };

  if (l.is_mine) {
    $('#status', el).onclick = async (e) => {
      const b = e.target.closest('button[data-s]'); if (!b || b.classList.contains('on')) return;
      const s = b.dataset.s;
      if (s === 'sold') return pickBuyer(l);
      try {
        await patch(`/listings/${l.id}`, { status: s });
        toast(s === 'pending' ? 'Marked pending' : 'Marked available');
        detail({ params: [l.id] });
      } catch (err) { toast(err.message, { error: true }); }
    };
    $('#delete', el).onclick = async () => {
      if (!(await confirmSheet({ title: 'Delete this listing?', body: 'It will be removed from the marketplace. This can\'t be undone.', confirm: 'Delete', danger: true }))) return;
      await del(`/listings/${l.id}`);
      toast('Listing deleted');
      navigate('/profile', { replace: true });
    };
  }
}

// When marking sold, the seller picks who bought it so the buyer can rate them.
export function pickBuyer(l, onDone) {
  const buyers = l.interested_buyers || [];
  const finish = async (buyerId, close) => {
    try {
      await patch(`/listings/${l.id}`, { status: 'sold', sold_to_user_id: buyerId });
      close();
      toast('Marked sold 🎉');
      if (onDone) onDone(); else detail({ params: [l.id] });
    } catch (err) { toast(err.message, { error: true }); }
  };
  openSheet(String(html`
    <h2>Who bought it?</h2>
    <p class="muted small" style="margin-bottom:12px">They'll be asked to give you a quick 👍 or 👎, which builds your seller rating.</p>
    <div class="list" style="box-shadow:none;border:1px solid var(--border)">
      ${buyers.map((b) => html`<button class="list-item" data-b="${b.id}">${avatar(b, 'sm')}<span class="grow">${b.display_name}</span>${icon('chev', 'chev')}</button>`)}
      <button class="list-item" data-b=""><span class="grow muted">Someone else / not sure</span>${icon('chev', 'chev')}</button>
    </div>
    <button class="btn block secondary" style="margin-top:12px" data-close>Cancel</button>`), (el, close) => {
    el.onclick = (e) => {
      const b = e.target.closest('[data-b]');
      if (b) finish(b.dataset.b || null, close);
    };
  });
}
