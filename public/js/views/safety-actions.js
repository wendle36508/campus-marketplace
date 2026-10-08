// Report + block flows, shared by listing, chat and profile screens.
import { post, del } from '../api.js';
import { html, icon, openSheet, toast, confirmSheet, spinnerBtn, $ } from '../ui.js';
import { state } from '../state.js';

export function reportSheet({ listingId = null, userId = null, name = '' }) {
  const reasons = state.config.report_reasons;
  const what = listingId ? 'this listing' : `${name || 'this student'}`;
  openSheet(String(html`
    <h2>Report ${what}</h2>
    <p class="muted small" style="margin-bottom:12px">Reports are private. A ${state.config.school.short_name} admin reviews every one.</p>
    <div class="stack" id="reasons">
      ${reasons.map((r) => html`<label class="list-item" style="border:1px solid var(--border);border-radius:12px"><input type="radio" name="reason" value="${r.id}" style="width:20px;height:20px;accent-color:var(--brand)"><span>${r.label}</span></label>`)}
      <textarea class="input" id="details" placeholder="Anything else we should know? (optional)" maxlength="1000"></textarea>
      <button class="btn block danger" id="send" disabled>Send report</button>
      <button class="btn block secondary" data-close>Cancel</button>
    </div>`), (el, close) => {
    const send = $('#send', el);
    el.addEventListener('change', () => { send.disabled = !el.querySelector('input[name=reason]:checked'); });
    send.onclick = async () => {
      const reason = el.querySelector('input[name=reason]:checked').value;
      spinnerBtn(send, true);
      try {
        await post('/reports', { listing_id: listingId, user_id: userId, reason, details: $('#details', el).value });
        close();
        toast('Thanks. Your report was sent to the admins.');
      } catch (err) {
        spinnerBtn(send, false);
        toast(err.message, { error: true });
      }
    };
  });
}

export async function blockUser(user, onDone) {
  const ok = await confirmSheet({
    title: `Block ${user.first_name}?`,
    body: `You won't see each other's listings and ${user.first_name} won't be able to message you. They won't be notified.`,
    confirm: 'Block',
    danger: true,
  });
  if (!ok) return;
  try {
    await post('/blocks', { user_id: user.id });
    toast(`${user.first_name} is blocked`);
    if (onDone) onDone();
  } catch (err) { toast(err.message, { error: true }); }
}

export async function unblockUser(user, onDone) {
  try {
    await del(`/blocks/${user.id}`);
    toast(`${user.first_name} is unblocked`);
    if (onDone) onDone();
  } catch (err) { toast(err.message, { error: true }); }
}

// "..." menu with report/block options
export function moreMenu({ listing = null, user, onBlocked }) {
  openSheet(String(html`
    <div class="list" style="box-shadow:none;border:1px solid var(--border)">
      ${listing ? html`<button class="list-item" data-a="report-listing">${icon('flag')}<span>Report listing</span></button>` : ''}
      <button class="list-item" data-a="report-user">${icon('flag')}<span>Report ${user.first_name}</span></button>
      <button class="list-item" data-a="block" style="color:var(--danger)">${icon('ban')}<span>Block ${user.first_name}</span></button>
    </div>
    <button class="btn block secondary" style="margin-top:12px" data-close>Cancel</button>`), (el, close) => {
    el.onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      close();
      if (b.dataset.a === 'report-listing') reportSheet({ listingId: listing.id });
      if (b.dataset.a === 'report-user') reportSheet({ userId: user.id, name: user.first_name });
      if (b.dataset.a === 'block') blockUser(user, onBlocked);
    };
  });
}
