// Marketplace feed: search, category chips, filters, listing grid.
import { get } from '../api.js';
import { html, icon, render, listingTile, openSheet, $, $$ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell } from '../app.js';

function activeFilterCount(f) {
  return (f.condition.length ? 1 : 0) + (f.min !== '' ? 1 : 0) + (f.max !== '' ? 1 : 0) + (f.sort !== 'new' ? 1 : 0);
}

function queryString(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.condition.length) p.set('condition', f.condition.join(','));
  if (f.min !== '') p.set('min', f.min);
  if (f.max !== '') p.set('max', f.max);
  if (f.move_out) p.set('move_out', '1');
  if (f.sort === 'price_asc' || f.sort === 'price_desc') p.set('sort', f.sort);
  return p.toString();
}

export async function feed() {
  const f = state.feedFilters;
  const school = state.config.school;
  const cats = state.config.categories;

  const el = mount(shell({
    active: 'home',
    body: html`
      <div class="search-wrap">
        <form class="search" id="search-form" role="search">
          ${icon('search')}
          <input class="input" id="q" type="search" enterkeyhint="search" placeholder="Search ${school.short_name} listings" value="${f.q}" autocomplete="off">
          <button type="button" class="filter-btn" id="filters" aria-label="Filters">${icon('sliders')}<span class="dot ${activeFilterCount(f) ? '' : 'hidden'}"></span></button>
        </form>
        <div class="chip-row" style="margin-top:10px" id="chips">
          <button class="chip moveout ${f.move_out ? 'on' : ''}" data-moveout>📦 Move-Out Sale</button>
          <button class="chip ${!f.category ? 'on' : ''}" data-cat="">All</button>
          ${cats.map((c) => html`<button class="chip ${f.category === c ? 'on' : ''}" data-cat="${c}">${c}</button>`)}
        </div>
      </div>
      <div class="stack">
        <div class="trust-strip">${icon('shield')}<span>Everyone here is a verified ${school.short_name} student.</span><a href="#/safety">Safety</a></div>
        <div id="moveout-promo"></div>
        <div class="row between"><h2 id="feed-title">Fresh listings</h2><span class="small muted" id="count"></span></div>
        <div id="results"><div class="grid">${Array.from({ length: 6 }, () => html`<div class="tile"><div class="ph shimmer"></div><div class="body"><div class="shimmer" style="height:18px;width:50%"></div><div class="shimmer" style="height:14px;margin-top:6px"></div></div></div>`)}</div></div>
      </div>`,
  }));

  let seq = 0;
  async function load() {
    const mySeq = ++seq;
    const title = f.move_out ? 'Move-Out Sale' : f.category || (f.q ? `Results for “${f.q}”` : 'Fresh listings');
    $('#feed-title', el).textContent = title;
    $('.filter-btn .dot', el).classList.toggle('hidden', !activeFilterCount(f));
    render($('#moveout-promo', el), f.move_out || f.q || f.category ? '' : html`
      <div class="moveout-banner" id="promo"><div class="big">📦</div><div class="grow"><h3>Move-Out Sale</h3><p class="small" style="opacity:.9">Seniors and movers are clearing out fridges, rugs and furniture. Grab deals before they're gone.</p></div>${icon('chev')}</div>`);
    const promo = $('#promo', el);
    if (promo) promo.onclick = () => { f.move_out = true; syncChips(); load(); };

    try {
      const { listings } = await get(`/listings?${queryString(f)}`);
      if (mySeq !== seq) return;
      $('#count', el).textContent = `${listings.length} item${listings.length === 1 ? '' : 's'}`;
      render($('#results', el), listings.length
        ? html`<div class="grid">${listings.map((l) => listingTile(l, school.short_name))}</div>`
        : html`<div class="empty"><div class="big">🔍</div><p><b>Nothing here yet.</b></p><p class="small" style="margin-top:4px">Try a different search or filter, or be the first to post one.</p><p style="margin-top:16px"><a class="btn soft" href="#/sell">Sell something</a></p></div>`);
    } catch (err) {
      render($('#results', el), html`<div class="empty"><p>${err.message}</p></div>`);
    }
  }

  function syncChips() {
    $$('[data-cat]', el).forEach((b) => b.classList.toggle('on', b.dataset.cat === f.category));
    $('[data-moveout]', el).classList.toggle('on', f.move_out);
  }

  $('#chips', el).onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-moveout')) f.move_out = !f.move_out;
    else f.category = b.dataset.cat;
    syncChips();
    load();
  };

  let t;
  const q = $('#q', el);
  q.oninput = () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value.trim(); load(); }, 300); };
  $('#search-form', el).onsubmit = (e) => { e.preventDefault(); f.q = q.value.trim(); q.blur(); load(); };
  $('#filters', el).onclick = () => openFilters(f, () => { syncChips(); load(); });

  await load();
  return () => clearTimeout(t);
}

function openFilters(f, onApply) {
  const conds = state.config.conditions;
  const sorts = [['new', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];
  openSheet(String(html`
    <h2>Filters</h2>
    <div class="stack loose">
      <div class="field"><span class="label">Price</span>
        <div class="row">
          <div class="price-input grow"><span>$</span><input class="input" id="fmin" inputmode="decimal" placeholder="Min" value="${f.min}"></div>
          <span class="muted">to</span>
          <div class="price-input grow"><span>$</span><input class="input" id="fmax" inputmode="decimal" placeholder="Max" value="${f.max}"></div>
        </div>
        <div class="row wrap" style="margin-top:4px">${[['0', '0', 'Free'], ['', '25', 'Under $25'], ['', '50', 'Under $50'], ['', '100', 'Under $100']].map(([a, b, l]) => html`<button class="chip" data-range="${a}|${b}">${l}</button>`)}</div>
      </div>
      <div class="field"><span class="label">Condition</span>
        <div class="segmented" id="fcond">${conds.map((c) => html`<button type="button" class="${f.condition.includes(c) ? 'on' : ''}" data-c="${c}">${c}</button>`)}</div>
      </div>
      <label class="toggle"><span><b>Move-Out Sale only</b><br><span class="small muted">Items tagged by students moving out</span></span><input type="checkbox" id="fmove" ${f.move_out ? 'checked' : ''}><span class="track"></span></label>
      <div class="field"><span class="label">Sort by</span>
        <div class="segmented" id="fsort">${sorts.map(([v, l]) => html`<button type="button" class="${f.sort === v ? 'on' : ''}" data-s="${v}">${l}</button>`)}</div>
      </div>
      <div class="row">
        <button class="btn secondary grow" id="freset">Reset</button>
        <button class="btn grow" id="fapply">Show results</button>
      </div>
    </div>`), (el, close) => {
    const draft = { condition: [...f.condition], sort: f.sort };
    $('#fcond', el).onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const c = b.dataset.c;
      draft.condition = draft.condition.includes(c) ? draft.condition.filter((x) => x !== c) : [...draft.condition, c];
      b.classList.toggle('on');
    };
    $('#fsort', el).onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      draft.sort = b.dataset.s;
      $$('#fsort button', el).forEach((x) => x.classList.toggle('on', x === b));
    };
    $$('[data-range]', el).forEach((b) => (b.onclick = () => { const [a, z] = b.dataset.range.split('|'); $('#fmin', el).value = a; $('#fmax', el).value = z; }));
    $('#freset', el).onclick = () => {
      Object.assign(f, { condition: [], min: '', max: '', move_out: false, sort: 'new', category: '' });
      close(); onApply();
    };
    $('#fapply', el).onclick = () => {
      const num = (v) => (v.trim() === '' || isNaN(Number(v)) ? '' : String(Math.max(0, Number(v))));
      Object.assign(f, { condition: draft.condition, sort: draft.sort, min: num($('#fmin', el).value), max: num($('#fmax', el).value), move_out: $('#fmove', el).checked });
      close(); onApply();
    };
  });
}
