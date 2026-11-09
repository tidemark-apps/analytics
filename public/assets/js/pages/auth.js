import { html, useState, useEffect, api, navigate, leaveSignIn, Link, toast, useLocation, Icon } from '../lib.js';
import { Field } from '../ui.js';
import { Lockup } from '../logo.js';
import { registry } from '../extensions.js';
import { passkeysSupported, usePasskey } from '../webauthn.js';


function AuthShell({ title, sub, children }) {
  return html`<div class="auth-body"><div class="auth-card">
    <div class="brand big"><${Lockup} size=${36} /></div>
    <div><h1>${title}</h1><p class="auth-sub">${sub}</p></div>${children}</div><${LegalLinks} /></div>`;
}

/** Terms / privacy / refund links, shown when the installation configures them (TIDEMARK_TERMS_URL and friends). */
function LegalLinks() {
  const l = window.SD.legal || {};
  const items = [['terms', 'Terms'], ['privacy', 'Privacy notice'], ['refunds', 'Refund policy']].filter(([k]) => l[k]);
  if (!items.length) return null;
  return html`<nav class="legal-links" aria-label="Legal">${items.map(([k, label]) => html`<a href=${l[k]} target="_blank" rel="noopener">${label}</a>`)}</nav>`;
}

const METHOD_LABEL = { passkey: 'Use a passkey', totp: 'Use your authenticator app', email: 'Email me a code', recovery: 'Use a recovery code' };
const METHOD_HELP = {
  totp: 'Enter the 6-digit code from your authenticator app.',
  email: 'Enter the 6-digit code we emailed to you. It expires in 10 minutes.',
  recovery: 'Enter one of your recovery codes. Each works once.',
};

export function Login({ setUser }) {
  const [f, setF] = useState({ email: '', password: '', code: '' });
  const [methods, setMethods] = useState(null); // set once the password was accepted and a second step is needed
  const [method, setMethod] = useState('totp');
  const [canReset, setCanReset] = useState(false);
  useEffect(() => { api('/config').then((c) => setCanReset(!!c.password_reset)).catch(() => {}); }, []);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fail = (x) => { setErr(x.name === 'NotAllowedError' ? 'The passkey request was cancelled or not allowed.' : (x.errors && Object.values(x.errors)[0][0]) || x.message); setBusy(false); };
  const finish = (r) => { setUser(r.user); leaveSignIn(); };
  const credentials = { email: f.email, password: f.password };

  const choose = async (m) => {
    setMethod(m); setErr(''); setNote(''); setF((v) => ({ ...v, code: '' }));
    if (m === 'email') await sendEmail();
    if (m === 'passkey') await passkey();
  };
  const sendEmail = async (again) => {
    setBusy(true);
    try { await api('/auth/two-factor/email', { method: 'POST', body: credentials }); setNote(again ? 'A new code is on its way to your email.' : 'We emailed you a code.'); setBusy(false); } catch (x) { fail(x); }
  };
  const passkey = async () => {
    setBusy(true); setErr('');
    try {
      const options = await api('/auth/two-factor/passkey', { method: 'POST', body: credentials });
      finish(await api('/auth/login', { method: 'POST', body: { ...credentials, method: 'passkey', passkey: await usePasskey(options) } }));
    } catch (x) { fail(x); }
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      if (methods && method === 'passkey') return await passkey();
      const r = await api('/auth/login', { method: 'POST', body: methods ? { ...f, method } : f });
      if (r._status === 202) {
        const usable = (r.methods || ['totp']).filter((m) => m !== 'passkey' || passkeysSupported());
        const first = usable[0];
        setMethods(usable); setMethod(first); setBusy(false);
        if (first === 'passkey') await passkey(); // the browser asks straight away; the other methods stay one click away
        else if (first === 'email') await sendEmail();
        return;
      }
      finish(r);
    } catch (x) { fail(x); }
  };
  const others = (methods || []).filter((m) => m !== method);
  return html`<${AuthShell} title="Welcome back" sub=${methods ? 'One more step to sign in.' : 'Sign in to your analytics.'}>
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      ${note && html`<div class="notice good"><${Icon} name="circle-check" size=${16} /><div>${note}</div></div>`}
      <${Field} label="Email"><input type="email" required autofocus=${!methods} autocomplete="username" readonly=${!!methods} value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /><//>
      ${!methods && html`<${Field} label="Password"><input type="password" required autocomplete="current-password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /><//>`}
      ${methods && method !== 'passkey' && html`<${Field} label=${method === 'recovery' ? 'Recovery code' : 'Authentication code'} help=${METHOD_HELP[method]}><input inputmode=${method === 'recovery' ? 'text' : 'numeric'} autocomplete="one-time-code" autofocus required autocapitalize="off" spellcheck="false" value=${f.code} onInput=${(e) => setF({ ...f, code: e.target.value })} /><//>`}
      ${methods && method === 'passkey' && html`<p class="help">Use the passkey on this device, or a security key, to finish signing in.</p>`}
      <button class="btn primary" disabled=${busy}>${busy ? (method === 'passkey' && methods ? 'Waiting for your passkey…' : 'Signing in…') : methods && method === 'passkey' ? 'Use passkey' : 'Sign in'}</button>
      ${methods && method === 'email' && html`<div class="auth-links"><a href="#" onClick=${(e) => { e.preventDefault(); if (!busy) sendEmail(true); }}>Send a new code</a></div>`}
      ${others.length > 0 && html`<div class="auth-links">${others.map((m, i) => html`${i > 0 ? ' · ' : ''}<a href="#" onClick=${(e) => { e.preventDefault(); choose(m); }}>${METHOD_LABEL[m]}</a>`)}</div>`}
      ${!methods && canReset && html`<div class="auth-links"><${Link} to="/forgot-password">Forgot your password?<//></div>`}
      ${!methods && window.SD.registration && html`<div class="auth-links">New here? <${Link} to=${'/register' + location.search}>Create an account<//></div>`}
    </form><//>`;
}

export function Register({ setUser }) {
  const [f, setF] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [extras, setExtras] = useState({});
  const [err, setErr] = useState('');
  if (!window.SD.registration) return html`<${AuthShell} title="Registration is closed" sub="Ask an administrator for an account."><${Link} to="/login" class="btn">Back to sign in<//><//>`;
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/auth/register', { method: 'POST', body: { ...extras, ...f } }); setUser(r.user); leaveSignIn(); toast('Welcome!'); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return html`<${AuthShell} title="Create your account" sub="Privacy-first analytics in a minute.">
    <form class="stack" onSubmit=${submit}>${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      <${Field} label="Name"><input required value=${f.name} onInput=${set('name')} /><//>
      <${Field} label="Email"><input type="email" required value=${f.email} onInput=${set('email')} /><//>
      <${Field} label="Password" help="At least 8 characters."><input type="password" required minlength="8" autocomplete="new-password" value=${f.password} onInput=${set('password')} /><//>
      <${Field} label="Confirm password"><input type="password" required autocomplete="new-password" value=${f.password_confirmation} onInput=${set('password_confirmation')} /><//>
      ${registry.signupFields.map((Extra, i) => html`<${Extra} key=${i} values=${extras} set=${(k, v) => setExtras((x) => ({ ...x, [k]: v }))} />`)}
      ${(window.SD.legal || {}).terms && html`<p class="help auth-links" style="font-size:12px">By creating an account you agree to the <a href=${window.SD.legal.terms} target="_blank" rel="noopener">Terms of Service</a>${window.SD.legal.privacy ? html` and acknowledge the <a href=${window.SD.legal.privacy} target="_blank" rel="noopener">privacy notice</a>` : ''}.</p>`}
      <button class="btn primary">Create account</button>
      <div class="auth-links">Have an account? <${Link} to=${'/login' + location.search}>Sign in<//></div>
    </form><//>`;
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/auth/forgot-password', { method: 'POST', body: { email } }); setSent(true); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); }
  };
  return html`<${AuthShell} title="Reset your password" sub="We'll email you a link to choose a new one.">
    ${sent ? html`<div class="notice good"><${Icon} name="circle-check" size=${16} /><div>If an account exists for <b>${email}</b>, a reset link is on its way. It expires in an hour.</div></div><${Link} to="/login" class="btn">Back to sign in<//>`
      : html`<form class="stack" onSubmit=${submit}>${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
        <${Field} label="Email"><input type="email" required autofocus autocomplete="username" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
        <button class="btn primary">Send reset link</button>
        <div class="auth-links"><${Link} to="/login">Back to sign in<//></div></form>`}<//>`;
}

export function ResetPassword() {
  const { query } = useLocation();
  const [f, setF] = useState({ password: '', password_confirmation: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/auth/reset-password', { method: 'POST', body: { ...f, token: query.token, email: query.email } }); setDone(true); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); }
  };
  if (!query.token || !query.email) return html`<${AuthShell} title="Link problem" sub="This reset link is incomplete."><${Link} to="/forgot-password" class="btn">Request a new link<//><//>`;
  return html`<${AuthShell} title="Choose a new password" sub=${query.email}>
    ${done ? html`<div class="notice good"><${Icon} name="circle-check" size=${16} /><div>Your password was changed.</div></div><${Link} to="/login" class="btn primary">Sign in<//>`
      : html`<form class="stack" onSubmit=${submit}>${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
        <${Field} label="New password" help="At least 8 characters."><input type="password" required minlength="8" autofocus autocomplete="new-password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /><//>
        <${Field} label="Confirm new password"><input type="password" required autocomplete="new-password" value=${f.password_confirmation} onInput=${(e) => setF({ ...f, password_confirmation: e.target.value })} /><//>
        <button class="btn primary">Change password</button></form>`}<//>`;
}

/** The page behind the link in an invitation e-mail: set a name and password (or sign in) and land on the shared site. */
export function Invite({ setUser }) {
  const { query } = useLocation();
  const [info, setInfo] = useState(null);
  const [gone, setGone] = useState(!query.token);
  const [f, setF] = useState({ name: '', password: '', password_confirmation: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (query.token) api('/invites/' + query.token).then(setInfo).catch(() => setGone(true)); }, [query.token]);
  if (gone) return html`<${AuthShell} title="Invitation not valid" sub="This invitation has expired or was already used. Invitations last 72 hours; ask the person who sent it to invite you again."><${Link} to="/login" class="btn">Go to sign in<//><//>`;
  if (!info) return html`<${AuthShell} title="Invitation" sub="Loading…"><//>`;
  const what = info.organization ? html`<b>${info.inviter || 'Someone'}</b> invited you to help manage <b>${info.organization}</b>. You will be able to see and change every site in it.` : info.team ? html`<b>${info.inviter || 'Someone'}</b> invited you to the <b>${info.team}</b> team. It gives you access to the sites the team is shared with.` : html`<b>${info.inviter || 'Someone'}</b> invited you to <b>${info.site}</b> as ${info.role === 'admin' ? 'an admin' : 'a viewer'}.`;
  const accept = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api('/invites/' + query.token + '/accept', { method: 'POST', body: f }); const me = await api('/me'); setUser(me.user); navigate(r.site ? '/' + r.site : '/sites'); toast('Welcome!'); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); setBusy(false); }
  };
  if (info.has_account) {
    const mine = info.signed_in_as && info.signed_in_as.toLowerCase() === info.email.toLowerCase();
    return html`<${AuthShell} title="You have an invitation" sub=${info.email}>
      <p>${what}</p>
      ${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      ${mine ? html`<button class="btn primary" disabled=${busy} onClick=${accept}>Accept</button>` : html`<p class="help">You already have an account with this address. Sign in with it, then open this link again.</p><${Link} to="/login" class="btn primary">Sign in<//>`}<//>`;
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return html`<${AuthShell} title="Accept your invitation" sub=${info.email}>
    <p>${what} Choose a name and password to create your account.</p>
    <form class="stack" onSubmit=${accept}>${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      <${Field} label="Name"><input required autofocus value=${f.name} onInput=${set('name')} /><//>
      <${Field} label="Password" help="At least 8 characters."><input type="password" required minlength="8" autocomplete="new-password" value=${f.password} onInput=${set('password')} /><//>
      <${Field} label="Confirm password"><input type="password" required autocomplete="new-password" value=${f.password_confirmation} onInput=${set('password_confirmation')} /><//>
      ${(window.SD.legal || {}).terms && html`<p class="help auth-links" style="font-size:12px">By creating an account you agree to the <a href=${window.SD.legal.terms} target="_blank" rel="noopener">Terms of Service</a>${window.SD.legal.privacy ? html` and acknowledge the <a href=${window.SD.legal.privacy} target="_blank" rel="noopener">privacy notice</a>` : ''}.</p>`}
      <button class="btn primary" disabled=${busy}>${busy ? 'Creating…' : info.team ? 'Create account' : 'Create account and open the site'}</button>
    </form><//>`;
}
