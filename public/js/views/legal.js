// Terms, Privacy Policy and Community Guidelines, plus the agreement screen.
import { get, post } from '../api.js';
import { html, raw, icon, spinnerBtn, $, $$ } from '../ui.js';
import { state } from '../state.js';
import { mount, shell, navigate, refreshMe } from '../app.js';

// "Terms · Privacy · Guidelines", used on the sign-in screen, the agreement
// screen and the profile page.
export function legalLinks() {
  return html`<p class="tiny muted center legal-links"><a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a> · <a href="#/guidelines">Guidelines</a></p>`;
}

export async function doc({ params }) {
  const key = params[0];
  const d = await get(`/legal/${key}`);
  mount(shell({
    title: d.title, back: true, nav: false,
    body: html`<article class="legal-doc">${raw(d.html)}</article>`,
  }));
}

export async function agree() {
  const me = state.me;
  const school = state.config.school;
  const legal = state.config.legal;
  const returning = me && me.agreed_before;
  const el = mount(shell({
    title: 'Before you start', nav: false,
    body: html`
      <form class="stack loose" id="agree-form" novalidate>
        ${returning && legal.what_changed ? html`<div class="notice">${icon('info')}<span><b>What changed:</b> ${legal.what_changed}</span></div>` : ''}
        <p class="small muted">${state.config.app_name} is an independent student project. It is not affiliated with ${school ? school.name : 'your school'}.</p>
        <div class="card stack">
          <label class="check-row"><input type="checkbox" id="student"><span>I'm a current ${school ? school.short_name : ''} student.</span></label>
        </div>
        <div class="card stack">
          <b>How old are you?</b>
          <label class="check-row"><input type="radio" name="age" value="18_plus"><span>I'm 18 or older.</span></label>
          <label class="check-row"><input type="radio" name="age" value="17_with_parent"><span>I'm 17, and a parent or guardian knows I use the app and agrees to these terms.</span></label>
          <label class="check-row"><input type="radio" name="age" value="under_17"><span>I'm under 17.</span></label>
          <div class="notice warn hidden" id="too-young">${icon('info')}<span>Sorry, you must be 17 or older to use ${state.config.app_name}.</span></div>
        </div>
        <div class="card stack">
          <label class="check-row"><input type="checkbox" id="agree"><span>I agree to the <a href="#/terms">Terms</a> and <a href="#/guidelines">Community Guidelines</a> and have read the <a href="#/privacy">Privacy Policy</a>.</span></label>
        </div>
        <div class="notice warn hidden" id="err">${icon('info')}<span></span></div>
        <button class="btn block" type="submit" id="go" disabled>Continue</button>
        <button class="btn block secondary" type="button" id="logout">Sign out</button>
      </form>`,
  }));

  const form = $('#agree-form', el);
  const go = $('#go', el);
  const age = () => ($('input[name=age]:checked', el) || {}).value;
  const update = () => {
    const young = age() === 'under_17';
    $('#too-young', el).classList.toggle('hidden', !young);
    go.disabled = young || !age() || !$('#student', el).checked || !$('#agree', el).checked;
  };
  $$('input', el).forEach((i) => { i.onchange = update; });
  $('#logout', el).onclick = async () => { await post('/auth/logout'); state.me = null; navigate('/welcome', { replace: true }); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (go.disabled) return;
    spinnerBtn(go, true, 'Saving…');
    try {
      await post('/me/agreement', { agree: true, current_student: true, age_choice: age() });
      await refreshMe();
      navigate(state.me.profile_complete ? '/' : '/onboarding', { replace: true });
    } catch (ex) {
      spinnerBtn(go, false);
      const err = $('#err', el);
      err.querySelector('span').textContent = ex.message;
      err.classList.remove('hidden');
    }
  };
}
