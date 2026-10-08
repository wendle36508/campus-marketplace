// Create (and edit) a listing. Photo first, then the AI fills in title,
// category, condition and a suggested price. Everything stays editable.
import { get, post, patch, uploadPhoto } from '../api.js';
import { html, icon, render, money, toast, spinnerBtn, $, $$ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell, navigate } from '../app.js';

export async function sell({ params: [editId] }) {
  const cfg = state.config;
  const school = cfg.school;
  const MAX = cfg.max_photos;
  let existing = null;
  if (editId) {
    existing = (await get(`/listings/${editId}`)).listing;
    if (!existing.is_mine) return navigate(`/listing/${editId}`, { replace: true });
  }

  const photos = existing ? existing.photos.map((url) => ({ url, preview: url, status: 'done' })) : [];
  let suggestion = null;
  let startedAt = null;
  const aiFields = new Set();
  const spotNames = school.meetup_spots.map((s) => s.name);
  const initialPickup = existing ? existing.pickup_location || '' : spotNames[0] || '';
  const pickupIsCustom = initialPickup && !spotNames.includes(initialPickup);

  const el = mount(shell({
    title: existing ? 'Edit listing' : 'Sell an item',
    back: !!existing,
    active: 'sell',
    body: html`
      <form class="stack loose" id="sell-form" novalidate>
        ${existing ? '' : html`<div class="stack tight"><h1>What are you selling?</h1><p class="muted">Snap a photo. Our AI suggests a title, category and fair student price.</p></div>`}

        <div id="picker" class="${photos.length ? 'hidden' : ''}">
          <div class="photo-pick">
            <label>${icon('camera')}<span>Take photo</span><input type="file" accept="image/*" capture="environment" data-pick></label>
            <label>${icon('image')}<span>Upload photos<br><span class="tiny" style="font-weight:500">up to ${MAX}</span></span><input type="file" accept="image/*" multiple data-pick></label>
          </div>
          ${existing ? '' : html`<p class="center small" style="margin-top:12px"><button type="button" class="btn ghost sm" id="manual">Or fill in details without AI</button></p>`}
        </div>

        <div id="thumbs-wrap" class="${photos.length ? '' : 'hidden'} stack tight">
          <div class="row between"><span class="label">Photos</span><span class="small muted" id="photo-count"></span></div>
          <div class="thumbs" id="thumbs"></div>
        </div>

        <div id="ai"></div>

        <div id="fields" class="stack loose ${photos.length || existing ? '' : 'hidden'}">
          <div class="field"><label for="title">Title</label><input class="input" id="title" maxlength="80" placeholder="e.g. Mini fridge, 3.1 cu ft" value="${existing ? existing.title : ''}"></div>
          <div class="field"><label for="price">Price</label>
            <div class="price-input"><span>$</span><input class="input" id="price" inputmode="decimal" placeholder="0" value="${existing ? existing.price : ''}"></div>
            <span class="hint" id="price-hint"></span>
          </div>
          <div class="field"><label for="category">Category</label>
            <select class="input" id="category">${['', ...cfg.categories].map((c) => html`<option value="${c}" ${existing && existing.category === c ? 'selected' : ''}>${c || 'Choose a category'}</option>`)}</select>
          </div>
          <div class="field"><span class="label">Condition</span>
            <div class="segmented" id="condition">${cfg.conditions.map((c) => html`<button type="button" data-c="${c}" class="${existing && existing.condition === c ? 'on' : ''}">${c}</button>`)}</div>
          </div>
          <div class="field"><label for="description">Description <span class="faint">(optional)</span></label><textarea class="input" id="description" maxlength="2000" placeholder="Size, brand, any wear, why you're selling">${existing ? existing.description : ''}</textarea></div>
          <div class="field"><span class="label">Pickup location</span>
            <span class="hint">${icon('shield')} Suggested safe meetup spots on campus</span>
            <div class="segmented" id="pickup">
              ${spotNames.map((n) => html`<button type="button" data-p="${n}" class="${initialPickup === n ? 'on' : ''}">${n}</button>`)}
              <button type="button" data-p="__other" class="${pickupIsCustom ? 'on' : ''}">Other</button>
            </div>
            <input class="input ${pickupIsCustom ? '' : 'hidden'}" id="pickup-other" placeholder="Where on campus?" maxlength="120" value="${pickupIsCustom ? initialPickup : ''}">
          </div>
          <label class="toggle card flat" style="padding:10px 14px"><span><b>📦 Move-Out Sale</b><br><span class="small muted">Tag it so movers and incoming students find it fast</span></span><input type="checkbox" id="moveout" ${existing && existing.move_out_sale ? 'checked' : ''}><span class="track"></span></label>
          <div id="mod"></div>
          <div class="notice danger hidden" id="err">${icon('warn')}<span></span></div>
          <button class="btn block" type="submit" id="submit">${existing ? 'Save changes' : 'Post listing'}</button>
        </div>
      </form>`,
  }));

  const f = {
    title: $('#title', el), price: $('#price', el), category: $('#category', el), description: $('#description', el),
    moveout: $('#moveout', el), pickupOther: $('#pickup-other', el),
  };
  let condition = existing ? existing.condition : '';
  let pickup = pickupIsCustom ? '__other' : initialPickup;

  // ---- photos ---------------------------------------------------------------
  function paintThumbs() {
    $('#picker', el).classList.toggle('hidden', photos.length > 0);
    $('#thumbs-wrap', el).classList.toggle('hidden', photos.length === 0);
    $('#photo-count', el).textContent = `${photos.length}/${MAX}`;
    render($('#thumbs', el), html`
      ${photos.map((p, i) => html`<div class="thumb ${p.status === 'uploading' ? 'loading' : ''}">
        <img src="${p.preview}" alt="">
        ${i === 0 ? html`<span class="cover">Cover</span>` : ''}
        ${p.status === 'uploading' ? html`<span class="spinner sm" style="position:absolute;top:calc(50% - 9px);left:calc(50% - 9px);z-index:1"></span>` : html`<button type="button" class="x" data-rm="${i}" aria-label="Remove photo">${icon('x')}</button>`}
      </div>`)}
      ${photos.length < MAX ? html`<label class="thumb add" aria-label="Add photo">${icon('plus')}<input type="file" accept="image/*" multiple data-pick></label>` : ''}`);
  }

  async function addFiles(files) {
    const list = [...files].slice(0, MAX - photos.length);
    if (!list.length) return toast(`You can add up to ${MAX} photos.`);
    if (!startedAt) startedAt = Date.now();
    $('#fields', el).classList.remove('hidden');
    const isFirst = photos.length === 0;
    const items = list.map((file) => ({ file, preview: URL.createObjectURL(file), status: 'uploading' }));
    photos.push(...items);
    paintThumbs();
    for (const [i, item] of items.entries()) {
      try {
        item.url = await uploadPhoto(item.file);
        item.status = 'done';
        if (isFirst && i === 0 && !existing) runAI(item);
      } catch (err) {
        photos.splice(photos.indexOf(item), 1);
        toast(err.message, { error: true });
      }
      paintThumbs();
    }
  }

  el.addEventListener('change', (e) => { if (e.target.matches('[data-pick]')) { addFiles(e.target.files); e.target.value = ''; } });
  $('#thumbs', el).onclick = (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    photos.splice(Number(b.dataset.rm), 1);
    paintThumbs();
  };
  const manual = $('#manual', el);
  if (manual) manual.onclick = () => { $('#fields', el).classList.remove('hidden'); manual.parentElement.remove(); startedAt = startedAt || Date.now(); };

  // ---- AI suggestion --------------------------------------------------------
  async function runAI(item) {
    const box = $('#ai', el);
    render(box, html`<div class="ai-card stack tight">
      <div class="head">${icon('sparkle')}Analyzing your photo…</div>
      <div class="shimmer" style="height:34px;width:40%"></div><div class="shimmer" style="height:14px;width:85%"></div></div>`);
    try {
      const { suggestion: s } = await post('/ai/suggest', { photo_url: item.url, hint: item.file ? item.file.name : '' });
      suggestion = s;
      applySuggestion(s);
      paintAI();
    } catch (err) {
      render(box, html`<div class="notice warn">${icon('info')}<span>Couldn't get a price suggestion (${err.message}). You can still fill it in yourself.</span></div>`);
    }
  }

  function setField(name, value) {
    if (value === undefined || value === null || value === '') return;
    if (name === 'condition') {
      condition = value;
      $$('#condition button', el).forEach((b) => b.classList.toggle('on', b.dataset.c === value));
      return;
    }
    f[name].value = value;
    f[name].classList.add('ai-filled');
    aiFields.add(name);
  }

  function applySuggestion(s) {
    if (!f.title.value.trim()) setField('title', s.title);
    if (!f.category.value) setField('category', s.category);
    if (!condition) setField('condition', s.condition);
    if (!f.description.value.trim()) setField('description', s.description);
    setField('price', String(s.price_recommended));
    syncFree();
  }

  function paintAI() {
    if (!suggestion) return;
    const s = suggestion;
    const applied = Number(f.price.value) === s.price_recommended;
    const label = s.source === 'ai' ? 'AI price suggestion' : s.source === 'demo' ? 'Price suggestion (demo mode)' : 'Rough price estimate';
    render($('#ai', el), html`<div class="ai-card stack tight">
      <div class="head">${icon('sparkle')}${label}</div>
      <div class="row between" style="align-items:flex-end">
        <div><div class="rec">${money(s.price_recommended)}</div><div class="range small">Fair range ${money(s.price_low)}–${money(s.price_high)}</div></div>
        <button type="button" class="btn sm ${applied ? 'secondary' : ''}" id="use-price" ${applied ? 'disabled' : ''}>${applied ? '✓ Applied' : `Use ${money(s.price_recommended)}`}</button>
      </div>
      <p class="small">${s.reason}</p>
      ${s.error ? html`<p class="tiny muted">${s.error}</p>` : ''}
      ${s.source === 'demo' ? html`<p class="tiny muted">Demo mode: add an AI key to get real photo-based suggestions.</p>` : html`<p class="tiny muted">Fields marked in purple were filled in by AI. Edit anything.</p>`}
    </div>`);
    $('#use-price', el).onclick = () => { setField('price', String(s.price_recommended)); paintAI(); };
  }

  // ---- other inputs -----------------------------------------------------------
  function syncFree() {
    const free = f.category.value === 'Free Stuff';
    if (free) f.price.value = '0';
    f.price.disabled = free;
    $('#price-hint', el).textContent = free ? 'Free Stuff listings are always $0.' : '';
  }
  f.category.onchange = () => { f.category.classList.remove('ai-filled'); syncFree(); };
  for (const k of ['title', 'description']) f[k].addEventListener('input', () => f[k].classList.remove('ai-filled'));
  f.price.addEventListener('input', () => { f.price.classList.remove('ai-filled'); paintAI(); });
  $('#condition', el).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    condition = b.dataset.c;
    $$('#condition button', el).forEach((x) => x.classList.toggle('on', x === b));
  };
  $('#pickup', el).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    pickup = b.dataset.p;
    $$('#pickup button', el).forEach((x) => x.classList.toggle('on', x === b));
    f.pickupOther.classList.toggle('hidden', pickup !== '__other');
    if (pickup === '__other') f.pickupOther.focus();
  };
  syncFree();

  // Live prohibited-item check
  let modTimer;
  const checkMod = () => {
    clearTimeout(modTimer);
    modTimer = setTimeout(async () => {
      try {
        const r = await post('/moderation/check', { title: f.title.value, description: f.description.value });
        render($('#mod', el), r.flagged ? html`<div class="notice warn">${icon('warn')}<span>This may be a prohibited item (${r.reasons.join(', ').toLowerCase()}). If you post it, it will be hidden until an admin reviews it.</span></div>` : '');
      } catch { /* ignore */ }
    }, 500);
  };
  f.title.addEventListener('input', checkMod);
  f.description.addEventListener('input', checkMod);
  if (existing) checkMod();

  // ---- submit -----------------------------------------------------------------
  $('#sell-form', el).onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#err', el);
    const fail = (m) => { err.querySelector('span').textContent = m; err.classList.remove('hidden'); err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    err.classList.add('hidden');
    if (photos.some((p) => p.status === 'uploading')) return fail('Hang on, your photos are still uploading.');
    if (!photos.length) return fail('Add at least one photo.');
    if (!f.title.value.trim()) return fail('Add a title.');
    if (f.price.value.trim() === '' || isNaN(Number(f.price.value))) return fail('Add a price (use 0 for free).');
    if (!f.category.value) return fail('Pick a category.');
    if (!condition) return fail('Pick a condition.');
    const body = {
      title: f.title.value.trim(),
      price: Number(f.price.value),
      category: f.category.value,
      condition,
      description: f.description.value.trim(),
      pickup_location: pickup === '__other' ? f.pickupOther.value.trim() : pickup,
      move_out_sale: f.moveout.checked,
      photos: photos.map((p) => p.url),
    };
    const btn = $('#submit', el);
    spinnerBtn(btn, true, existing ? 'Saving…' : 'Posting…');
    try {
      if (existing) {
        await patch(`/listings/${existing.id}`, body);
        toast('Changes saved');
        navigate(`/listing/${existing.id}`, { replace: true });
      } else {
        const res = await post('/listings', { ...body, ai_suggestion: suggestion });
        const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
        if (res.flagged) toast('Posted. It will appear once an admin reviews it.', { ms: 4000 });
        else toast(secs && secs < 600 ? `Posted in ${secs} second${secs === 1 ? '' : 's'}! 🎉` : 'Posted! 🎉', { ms: 3500 });
        navigate(`/listing/${res.listing.id}`, { replace: true });
      }
    } catch (ex) {
      spinnerBtn(btn, false);
      fail(ex.message);
    }
  };

  paintThumbs();
  return () => { clearTimeout(modTimer); photos.forEach((p) => p.file && URL.revokeObjectURL(p.preview)); };
}
