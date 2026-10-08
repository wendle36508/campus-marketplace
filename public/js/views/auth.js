// Sign up / verify / profile setup.
import { post, api, uploadPhoto } from '../api.js';
import { html, icon, toast, spinnerBtn, verifiedBadge, avatar, $ } from '../ui.js';
import { state } from '../state.js';
import { mount, navigate, refreshMe, shell } from '../app.js';

const EMAIL_KEY = 'pending_email';
const DEV_KEY = 'pending_dev_code';
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

const LINK_ERRORS = {
  link_expired: 'That sign-in link has expired or was already used. Enter your email to get a new one.',
  banned: 'This account has been suspended.',
  school_not_supported: "Right now we're only open to verified students at partner schools.",
};

export async function welcome({ query }) {
  const school = state.config.school;
  const domain = school ? school.email_domains[0] : 'school.edu';
  const el = mount(html`
    <div class="welcome">
      <div class="hero">
        <div class="logo"><img src="/img/icon.svg" alt="">${state.config.app_name}</div>
        <h1>The marketplace for verified ${school ? school.short_name : ''} students.</h1>
        <p>Buy and sell dorm stuff, textbooks and more with people from your campus. No strangers, no scams.</p>
      </div>
      <div class="panel">
        <form class="card stack" id="start-form" novalidate>
          <div class="field">
            <label for="email">Your school email</label>
            <input class="input" id="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@${domain}" required>
          </div>
          <div class="notice warn hidden" id="err">${icon('info')}<span></span></div>
          <button class="btn block" type="submit">Send my code</button>
          <p class="tiny muted center">We'll email a 6-digit code to confirm you're a student. Your email is never shown to other users.</p>
        </form>
        <div class="perks">
          <div>${icon('shield')}<span><b>Verified students only.</b> Everyone here signed up with a @${domain} email.</span></div>
          <div>${icon('sparkle')}<span><b>AI pricing.</b> Snap a photo and get a fair student price in seconds.</span></div>
          <div>${icon('pin')}<span><b>Safe campus meetups.</b> Chat in the app and meet at suggested safe spots.</span></div>
        </div>
      </div>
    </div>`);

  const form = $('#start-form', el);
  const input = $('#email', el);
  const err = $('#err', el);
  const showErr = (msg) => { err.querySelector('span').textContent = msg; err.classList.remove('hidden'); input.classList.add('error'); };
  if (query.error) showErr(LINK_ERRORS[query.error] || 'That link didn\'t work. Enter your email to try again.');
  input.value = store.get(EMAIL_KEY) || '';

  form.onsubmit = async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    input.classList.remove('error');
    const email = input.value.trim().toLowerCase();
    if (!email) return showErr('Enter your school email.');
    const btn = form.querySelector('button');
    spinnerBtn(btn, true, 'Sending…');
    try {
      const res = await post('/auth/start', { email });
      store.set(EMAIL_KEY, email);
      store.set(DEV_KEY, res.dev_code || null);
      navigate('/verify');
    } catch (ex) {
      spinnerBtn(btn, false);
      if (ex.code === 'cooldown') { store.set(EMAIL_KEY, email); navigate('/verify'); return; }
      showErr(ex.message);
    }
  };
}

export async function verify() {
  const email = store.get(EMAIL_KEY);
  if (!email) return navigate('/welcome', { replace: true });
  const dev = store.get(DEV_KEY);
  const el = mount(html`
    <header class="topbar with-back"><button class="icon-btn" data-back aria-label="Back">${icon('back')}</button><div class="title">Verify your email</div></header>
    <main class="page no-nav">
      <form class="stack loose" id="code-form" novalidate>
        <div class="stack tight" style="margin-top:12px">
          <h1>Check your inbox</h1>
          <p class="muted">We sent a 6-digit code to <b>${email}</b>. Enter it below, or tap the sign-in link in the email.</p>
        </div>
        ${dev ? html`<div class="dev-code">Demo mode: email isn't set up yet, so here's your code: <b>${dev}</b></div>` : ''}
        <input class="input code-input" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="••••••" aria-label="6-digit code">
        <div class="notice danger hidden" id="err">${icon('warn')}<span></span></div>
        <button class="btn block" type="submit">Verify and continue</button>
        <div class="row between">
          <button type="button" class="btn ghost sm" id="resend">Resend code</button>
          <button type="button" class="btn ghost sm" id="change">Use a different email</button>
        </div>
      </form>
    </main>`);

  const form = $('#code-form', el);
  const code = $('#code', el);
  const err = $('#err', el);
  const showErr = (m) => { err.querySelector('span').textContent = m; err.classList.remove('hidden'); };
  code.focus();
  const submit = async () => {
    const v = code.value.replace(/\D/g, '');
    if (v.length !== 6) return showErr('Enter all 6 digits.');
    const btn = form.querySelector('button[type=submit]');
    spinnerBtn(btn, true, 'Verifying…');
    try {
      const res = await post('/auth/verify', { email, code: v });
      store.set(DEV_KEY, null);
      await refreshMe();
      navigate(res.profile_complete ? '/' : '/onboarding', { replace: true });
    } catch (ex) {
      spinnerBtn(btn, false);
      showErr(ex.message);
      code.select();
    }
  };
  code.oninput = () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); err.classList.add('hidden'); if (code.value.length === 6) submit(); };
  form.onsubmit = (e) => { e.preventDefault(); submit(); };
  $('#change', el).onclick = () => { store.set(EMAIL_KEY, null); navigate('/welcome'); };
  $('#resend', el).onclick = async (e) => {
    try {
      const res = await post('/auth/start', { email });
      store.set(DEV_KEY, res.dev_code || null);
      toast('New code sent');
      if (res.dev_code) verify();
    } catch (ex) { toast(ex.message, { error: true }); }
    e.target.blur();
  };
}

// First-time profile setup, also used for "Edit profile".
export async function onboarding() {
  const me = state.me;
  const isEdit = me.profile_complete;
  const school = state.config.school;
  const year = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => year + i);
  if (me.grad_year && !years.includes(Number(me.grad_year))) years.unshift(Number(me.grad_year));
  let photoUrl = me.photo_url || null;

  const body = html`
    <form class="stack loose" id="profile-form" novalidate>
      ${isEdit ? '' : html`<div class="stack tight" style="margin-top:8px"><h1>You're verified! 🎉</h1><p class="muted">Set up your profile. Other students only see your first name, last initial and grad year.</p></div>`}
      <div class="profile-head">
        <label style="cursor:pointer;position:relative" aria-label="Add a profile photo">
          <span id="avatar">${avatar({ ...me, photo_url: photoUrl, first_name: me.first_name || '?' }, 'lg')}</span>
          <input type="file" accept="image/*" id="photo" class="hidden">
          <span class="tiny bold" style="display:block;margin-top:6px;color:var(--brand)">${photoUrl ? 'Change photo' : 'Add photo (optional)'}</span>
        </label>
        ${verifiedBadge(school.short_name)}
      </div>
      <div class="row" style="align-items:flex-start">
        <div class="field grow"><label for="first">First name</label><input class="input" id="first" autocomplete="given-name" value="${me.first_name || ''}" maxlength="30" required></div>
        <div class="field" style="width:110px"><label for="initial">Last initial</label><input class="input" id="initial" autocomplete="off" value="${me.last_initial || ''}" maxlength="1" style="text-align:center;text-transform:uppercase" required></div>
      </div>
      <div class="field"><label for="year">Graduation year</label>
        <select class="input" id="year">${years.map((y) => html`<option value="${y}" ${Number(me.grad_year) === y ? 'selected' : ''}>${y}</option>`)}</select>
      </div>
      <div class="notice info">${icon('lock')}<span>Your email (${me.email}) stays private. It's never shown to other students.</span></div>
      <div class="notice danger hidden" id="err">${icon('warn')}<span></span></div>
      <button class="btn block" type="submit">${isEdit ? 'Save profile' : 'Start browsing'}</button>
    </form>`;
  const el = mount(isEdit ? shell({ title: 'Edit profile', back: true, active: 'profile', body }) : html`<main class="page no-nav">${body}</main>`);

  $('#photo', el).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#avatar', el).innerHTML = '<div class="avatar lg"><span class="spinner sm"></span></div>';
    try {
      photoUrl = await uploadPhoto(f);
      $('#avatar', el).innerHTML = String(avatar({ photo_url: photoUrl }, 'lg'));
    } catch (ex) {
      toast(ex.message, { error: true });
      $('#avatar', el).innerHTML = String(avatar({ ...me, photo_url: null }, 'lg'));
    }
  };
  $('#profile-form', el).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    spinnerBtn(btn, true);
    try {
      await api('/me', { method: 'PUT', body: { first_name: $('#first', el).value, last_initial: $('#initial', el).value, grad_year: Number($('#year', el).value), photo_url: photoUrl } });
      await refreshMe();
      toast(isEdit ? 'Profile saved' : 'Welcome aboard!');
      navigate(isEdit ? '/profile' : '/', { replace: true });
    } catch (ex) {
      spinnerBtn(btn, false);
      const err = $('#err', el);
      err.querySelector('span').textContent = ex.message;
      err.classList.remove('hidden');
    }
  };
}

export async function logout() {
  await post('/auth/logout');
  state.me = null;
  navigate('/welcome', { replace: true });
}

