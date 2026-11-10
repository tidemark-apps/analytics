// Account settings: profile, security, API keys, teams, organization, users and updates.
import { html, useState, useEffect, useApi, api, navigate, Link, Icon, toast, copy, setTheme, currentTheme, UserCtx, useContext, useDocTitle, useLocation, ago } from './lib.js';
import { Loading, Section, ErrorBox, Field, Confirm, TypedConfirm, Modal, Toggle, CodeBlock, Avatar } from './ui.js';
import { squareImage } from './image.js';
import { useScope } from './org.js';
import { CreateOrganization, accountTabs } from './shell.js';
import { registry, pathAfterOrganizationCreated } from './extensions.js';
import { QrCode } from './qr.js';
import { passkeysSupported, createPasskey } from './webauthn.js';
import { SettingsShell, firstError, zones } from './settings-common.js';

const initial = (u) => (u.name || u.email || '?').slice(0, 1).toUpperCase();

/** A picture with Upload and Remove: a profile photo (round) or an organization logo (square). The page crops it to a square and shrinks it first. */
function ImageField({ label, name, url, shape, path, type, onChange, hint }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const body = new FormData();
      body.append('image', await squareImage(file, { type }), 'image');
      const r = await api(path, { method: 'POST', body });
      onChange(r.avatar_url !== undefined ? r.avatar_url : r.logo_url);
      toast(label + ' updated');
    } catch (x) { setErr(firstError(x)); }
    setBusy(false);
  };
  const remove = async () => { setBusy(true); setErr(null); try { const r = await api(path, { method: 'DELETE' }); onChange(r.avatar_url !== undefined ? r.avatar_url : r.logo_url); toast(label + ' removed'); } catch (x) { setErr(firstError(x)); } setBusy(false); };
  return html`<div class="image-field-wrap"><div class="image-field"><${Avatar} size="huge" name=${name} url=${url} shape=${shape} />
      <div class="ri-main"><b>${label}</b>
        <div class="row"><label class=${'btn sm' + (busy ? ' disabled' : '')}>${url ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled=${busy} onChange=${pick} /></label>${url && html`<button type="button" class="btn sm ghost danger" disabled=${busy} onClick=${remove}>Remove</button>`}</div></div></div>
    <span class="help">${hint}</span>${err && html`<span class="help" style="color:var(--destructive)">${err}</span>`}</div>`;
}

function Profile() {
  const { user, setUser } = useContext(UserCtx);
  const [f, setF] = useState({ name: user.name, email: user.email, timezone: user.timezone || 'UTC' });
  const [err, setErr] = useState(null);
  const [theme, setThemeState] = useState(currentTheme());
  const changed = f.name !== user.name || f.email !== user.email || f.timezone !== (user.timezone || 'UTC');
  const save = async (e) => { e.preventDefault(); setErr(null); try { const r = await api('/me', { method: 'POST', body: f }); setUser({ ...user, ...r.user }); toast('Saved'); } catch (x) { setErr(firstError(x)); } };
  const pick = (t) => { setTheme(t); setThemeState(t); };
  const THEMES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']];
  return html`<form onSubmit=${save}><${Section} title="Profile" help="Your name and email are used to sign in and are shown to people you share sites with."
      footer=${html`<span class="help">${changed ? 'You have unsaved changes.' : 'Your email is also where password resets are sent.'}</span><button class="btn primary sm" disabled=${!changed}>Save changes</button>`}>
        <${ImageField} label="Profile photo" name=${f.name} url=${user.avatar_url} shape="user" path="/me/avatar" type="image/jpeg" onChange=${(u) => setUser({ ...user, avatar_url: u })} hint="A square picture works best; it is cropped to a circle. PNG, JPEG or WebP. People you share sites with, and your Personal organization, show it." />
        ${err && html`<div class="alert">${err}</div>`}
        <div class="fields2"><${Field} label="Name"><input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /><//>
          <${Field} label="Email"><input type="email" required value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /><//></div>
        <${Field} label="Timezone" help="Used for dates in your own views. Each site's reports use that site's own timezone." class="tzfield"><select value=${f.timezone} onChange=${(e) => setF({ ...f, timezone: e.target.value })}>${zones().map((z) => html`<option value=${z} selected=${z === f.timezone}>${z}</option>`)}</select><//>
      <//></form>
    <${Section} title="Appearance" help="System follows your device and switches with it.">
      <div class="theme-opts" role="radiogroup" aria-label="Theme">${THEMES.map(([k, l]) => html`<button type="button" role="radio" aria-checked=${theme === k} class=${'theme-opt ' + k + (theme === k ? ' on' : '')} onClick=${() => pick(k)}><span class="tp" aria-hidden="true"><i></i><i></i><i></i></span><span>${l}</span></button>`)}</div><//>`;
}

function EmailReports() {
  const res = useApi('/me/reports', null, []);
  const [busy, setBusy] = useState(null);
  const sites = (res.data && res.data.data) || [];
  const choose = async (s, frequency) => {
    setBusy(s.id);
    try { await api('/me/reports/' + s.id, { method: 'PUT', body: { frequency } }); res.reload(); toast(frequency === 'off' ? 'Reports turned off for ' + s.domain : (frequency === 'weekly' ? 'Weekly' : 'Monthly') + ' reports on for ' + s.domain); } catch (x) { toast(firstError(x), 'err'); }
    setBusy(null);
  };
  return html`<${Section} title="Email reports" help="A short summary of each site: visitors, pageviews, top pages, sources and countries, goals and the notes on your graph, compared with the period before. Weekly reports arrive on Monday morning and monthly ones on the 1st, at 08:00 in each site's timezone.">
      ${res.data && !res.data.mail && html`<div class="alert">This installation can't send email yet. Reports will start going out once outgoing email is set up (see MAIL_MAILER in the environment file).</div>`}
      ${res.loading && !res.data ? html`<p class="muted">Loading…</p>` : sites.length === 0 ? html`<p class="muted">You don't have any sites yet.</p>`
        : html`<div class="rows">${sites.map((s) => html`<div class="rowitem boxed" key=${s.id}><span class="ri-ico" aria-hidden="true"><${Icon} name="mail" size=${16} /></span>
          <div class="grow ri-main"><b>${s.domain}</b><span class="muted">${s.frequency === 'weekly' ? 'Every Monday' : s.frequency === 'monthly' ? 'On the 1st of each month' : 'No email'}</span></div>
          <select style="width:auto;flex:none" aria-label=${'Email reports for ' + s.domain} disabled=${busy === s.id} value=${s.frequency || 'off'} onChange=${(e) => choose(s, e.target.value)}>
            <option value="off" selected=${!s.frequency}>Off</option><option value="weekly" selected=${s.frequency === 'weekly'}>Weekly</option><option value="monthly" selected=${s.frequency === 'monthly'}>Monthly</option></select></div>`)}</div>`}
      <p class="muted small">The emails hold only totals, with no tracking pixels or tracked links, and every one has an unsubscribe link.</p><//>`;
}

/** Recovery codes, shown once when they are made: the way back in if every other second step is out of reach. */
function RecoveryCodes({ codes, onDone }) {
  const text = codes.join('\n');
  const save = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([window.SD.name + ' recovery codes\n\n' + text + '\n'], { type: 'text/plain' })); a.download = 'recovery-codes.txt'; a.click(); URL.revokeObjectURL(a.href); };
  return html`<div class="goal-add"><b>Save your recovery codes</b>
    <p class="muted small" style="margin:0">Each code works once, in place of a second step, if you lose your phone or key. They are shown only now, so keep them somewhere safe, like a password manager.</p>
    <div class="recovery-codes">${codes.map((c) => html`<span key=${c}>${c}</span>`)}</div>
    <div class="row"><button class="btn" onClick=${() => copy(text)}><${Icon} name="copy" size=${14} /> Copy</button><button class="btn" onClick=${save}><${Icon} name="download" size=${14} /> Download</button><button class="btn primary" onClick=${onDone}>I've saved them</button></div></div>`;
}

function TwoFactor() {
  const { user, setUser } = useContext(UserCtx);
  const [st, setSt] = useState(null);
  const [panel, setPanel] = useState(null); // 'totp' | 'email' | 'passkey' | 'regen' | { kind, id, label } while removing something
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/me/two-factor').then(setSt).catch(() => {}); }, []);
  const close = () => { setPanel(null); setSetup(null); setCode(''); setPw(''); setName(''); };
  const done = (r, msg) => { setSt(r); if (r.recovery_codes) setCodes(r.recovery_codes); close(); toast(msg); api('/me').then((m) => setUser(m.user)).catch(() => {}); };
  const run = (fn) => async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setBusy(true);
    try { await fn(); } catch (x) { toast(x.name === 'NotAllowedError' ? 'The passkey request was cancelled or not allowed.' : firstError(x), 'err'); }
    setBusy(false);
  };
  if (!st) return html`<${Section} title="Two-factor authentication" help="Loading…" />`;

  const startTotp = run(async () => { setSetup(await api('/me/two-factor', { method: 'POST' })); setPanel('totp'); });
  const confirmTotp = run(async () => done(await api('/me/two-factor/confirm', { method: 'POST', body: { code } }), 'Authenticator app turned on'));
  const startEmail = run(async () => { await api('/me/two-factor/email', { method: 'POST' }); setPanel('email'); });
  const confirmEmail = run(async () => done(await api('/me/two-factor/email/confirm', { method: 'POST', body: { code } }), 'Email codes turned on'));
  const addPasskey = run(async () => {
    const options = await api('/me/passkeys/options', { method: 'POST' });
    const response = await createPasskey(options);
    done(await api('/me/passkeys', { method: 'POST', body: { name, ...response } }), 'Passkey added');
  });
  const remove = run(async () => {
    const r = panel;
    const url = r.kind === 'totp' ? '/me/two-factor' : r.kind === 'email' ? '/me/two-factor/email' : '/me/passkeys/' + r.id;
    done(await api(url, { method: 'DELETE', body: { password: pw } }), r.label + ' removed');
  });
  const regen = run(async () => done(await api('/me/two-factor/recovery-codes', { method: 'POST', body: { password: pw } }), 'New recovery codes made'));
  const cancel = html`<button type="button" class="btn" onClick=${close}>Cancel</button>`;
  const removing = panel && panel.kind;
  const supported = passkeysSupported();

  return html`<${Section} title="Two-factor authentication" help="Ask for a second step when you sign in, so a leaked password is not enough. Turn on as many methods as you like.">
    <div class="tf">
      <div class="rowitem boxed"><span class=${'ri-ico' + (st.authenticator ? ' good' : '')} aria-hidden="true"><${Icon} name="smartphone" size=${16} /></span>
        <div class="grow ri-main"><b>Authenticator app</b><span class="muted">${st.authenticator ? 'A code from your authenticator app is asked for at sign-in.' : 'Get a six-digit code from an app like 1Password, Authy or Google Authenticator.'}</span></div>
        ${st.authenticator ? html`<button class="btn sm danger" onClick=${() => setPanel({ kind: 'totp', label: 'Authenticator app' })}>Remove</button>` : panel !== 'totp' && html`<button class="btn sm primary" disabled=${busy} onClick=${startTotp}>Set up</button>`}</div>
      ${panel === 'totp' && setup && html`<form class="goal-add" onSubmit=${confirmTotp}>
        <p style="margin:0">Scan this code with your authenticator app, then enter the six-digit code it shows.</p>
        <div class="qr-wrap"><${QrCode} text=${setup.uri} /><div class="grow"><span class="muted small">Can't scan it? Enter this key instead:</span><${CodeBlock} text=${setup.secret} /><a class="btn" href=${setup.uri}>Open in an authenticator app</a></div></div>
        <${Field} label="Code" class="tzfield"><input inputmode="numeric" autocomplete="one-time-code" autofocus placeholder="123456" value=${code} onInput=${(e) => setCode(e.target.value)} /><//>
        <div class="row"><button class="btn primary" disabled=${!code.trim() || busy}>Confirm and turn on</button>${cancel}</div></form>`}

      <div class="rowitem boxed"><span class=${'ri-ico' + (st.email ? ' good' : '')} aria-hidden="true"><${Icon} name="mail" size=${16} /></span>
        <div class="grow ri-main"><b>Email codes</b><span class="muted">${st.email ? 'A code is emailed to ' + user.email + ' at sign-in.' : st.mail ? 'We email a one-time code to ' + user.email + ' at sign-in.' : 'Needs outgoing email, which this installation has not set up yet.'}</span></div>
        ${st.email ? html`<button class="btn sm danger" onClick=${() => setPanel({ kind: 'email', label: 'Email codes' })}>Turn off</button>` : panel !== 'email' && html`<button class="btn sm primary" disabled=${!st.mail || busy} onClick=${startEmail}>Turn on</button>`}</div>
      ${panel === 'email' && html`<form class="goal-add" onSubmit=${confirmEmail}>
        <p style="margin:0">We sent a code to <b>${user.email}</b>. Enter it to turn email codes on.</p>
        <${Field} label="Code" class="tzfield"><input inputmode="numeric" autocomplete="one-time-code" autofocus placeholder="123456" value=${code} onInput=${(e) => setCode(e.target.value)} /><//>
        <div class="row"><button class="btn primary" disabled=${!code.trim() || busy}>Confirm and turn on</button>${cancel}</div></form>`}

      <div class="rowitem boxed"><span class=${'ri-ico' + (st.passkeys.length ? ' good' : '')} aria-hidden="true"><${Icon} name="key" size=${16} /></span>
        <div class="grow ri-main"><b>Passkeys</b><span class="muted">${supported ? 'Confirm sign-in with your fingerprint, face, screen lock or a security key.' : 'This browser does not support passkeys.'}</span></div>
        ${supported && panel !== 'passkey' && html`<button class="btn sm primary" disabled=${busy} onClick=${() => setPanel('passkey')}>Add a passkey</button>`}</div>
      ${st.passkeys.map((k) => html`<div class="rowitem boxed" key=${k.id}><span class="ri-ico" aria-hidden="true"><${Icon} name="key" size=${16} /></span>
        <div class="grow ri-main"><b>${k.name}</b><span class="muted">Added ${ago(k.created_at)}${k.last_used_at ? ' · last used ' + ago(k.last_used_at) : ' · not used yet'}</span></div>
        <button class="btn sm danger" onClick=${() => setPanel({ kind: 'passkey', id: k.id, label: 'Passkey' })}>Remove</button></div>`)}
      ${panel === 'passkey' && html`<form class="goal-add" onSubmit=${addPasskey}>
        <${Field} label="Name" help="So you can tell your passkeys apart, like “MacBook” or “YubiKey”." class="tzfield"><input autofocus maxlength="100" placeholder="My phone" value=${name} onInput=${(e) => setName(e.target.value)} /><//>
        <div class="row"><button class="btn primary" disabled=${busy}>${busy ? 'Waiting for your device…' : 'Continue'}</button>${cancel}</div></form>`}

      ${removing && html`<form class="goal-add" onSubmit=${remove}>
        <${Field} label=${'Confirm your password to remove ' + (panel.label || '').toLowerCase()}><input type="password" autofocus required autocomplete="current-password" value=${pw} onInput=${(e) => setPw(e.target.value)} /><//>
        <div class="row"><button class="btn danger" disabled=${!pw || busy}>Remove</button>${cancel}</div></form>`}

      ${st.two_factor && html`<div class="rowitem boxed"><span class="ri-ico" aria-hidden="true"><${Icon} name="shield-check" size=${16} /></span>
        <div class="grow ri-main"><b>Recovery codes</b><span class=${'muted' + (st.recovery_left <= 2 ? ' warn' : '')}>${st.recovery_left} of 10 left. Use one if you can't reach any other method.</span></div>
        ${panel !== 'regen' && html`<button class="btn sm" onClick=${() => setPanel('regen')}>Make new codes</button>`}</div>`}
      ${panel === 'regen' && html`<form class="goal-add" onSubmit=${regen}>
        <p style="margin:0">New codes replace the old ones, which stop working.</p>
        <${Field} label="Confirm your password"><input type="password" autofocus required autocomplete="current-password" value=${pw} onInput=${(e) => setPw(e.target.value)} /><//>
        <div class="row"><button class="btn primary" disabled=${!pw || busy}>Make new codes</button>${cancel}</div></form>`}
      ${codes && html`<${RecoveryCodes} codes=${codes} onDone=${() => setCodes(null)} />`}
    </div><//>`;
}

function Security() {
  const { user, setUser } = useContext(UserCtx);
  const blank = { current_password: '', password: '', password_confirmation: '' };
  const [pw, setPw] = useState(blank);
  const [err, setErr] = useState(null);
  const changePw = async (e) => { e.preventDefault(); setErr(null); try { await api('/me/password', { method: 'POST', body: pw }); setPw(blank); toast('Password updated'); } catch (x) { setErr(firstError(x)); } };
  const mismatch = pw.password_confirmation !== '' && pw.password !== pw.password_confirmation;
  return html`<form onSubmit=${changePw}><${Section} title="Password" help="Use at least 8 characters."
      footer=${html`<span class="help">${mismatch ? 'The passwords don\'t match yet.' : 'Other signed-in devices stay signed in.'}</span><button class="btn primary sm" disabled=${!pw.current_password || !pw.password || mismatch}>Update password</button>`}>
        ${err && html`<div class="alert">${err}</div>`}
        <${Field} label="Current password" class="tzfield"><input type="password" required autocomplete="current-password" value=${pw.current_password} onInput=${(e) => setPw({ ...pw, current_password: e.target.value })} /><//>
        <div class="fields2"><${Field} label="New password"><input type="password" required minlength="8" autocomplete="new-password" value=${pw.password} onInput=${(e) => setPw({ ...pw, password: e.target.value })} /><//>
          <${Field} label="Confirm new password"><input type="password" required autocomplete="new-password" value=${pw.password_confirmation} onInput=${(e) => setPw({ ...pw, password_confirmation: e.target.value })} /><//></div>
      <//></form>
    <${TwoFactor} />
    <${SupportAccess} />
`;
}

/** Security → Support access: each time someone from the host looked at this account, and why. Only where the host can do that. */
function SupportAccess() {
  const { user } = useContext(UserCtx);
  const res = useApi('/me/support-sessions', null, []);
  if (!user.support_access) return null;
  const rows = (res.data && res.data.data) || [];
  return html`<${Section} title="Support access" help="When someone from support looks at your account to help you, it is listed here with who it was and why. They can look, but not change anything, and a session ends by itself within an hour.">
    ${res.data && !rows.length && html`<div class="empty-inline"><${Icon} name="shield-check" size=${18} /><div><b>No one has looked at your account</b><span>Support sessions will appear here.</span></div></div>`}
    ${rows.length > 0 && html`<ul class="rows" aria-label="Support sessions">${rows.map((r) => html`<li class="rowitem">
      <span class="ri-ico" aria-hidden="true"><${Icon} name="users" size=${16} /></span>
      <div class="grow ri-main"><b class="trunc">${r.staff_name}</b><span class="muted">${r.reason || 'No reason given'}${r.ticket ? ' · ' + r.ticket : ''} · ${ago(r.started_at.replace('T', ' ').slice(0, 19))}${r.open ? ' · open now' : ''}</span></div></li>`)}</ul>`}
  <//>`;
}

export function ApiKeys() {
  const res = useApi('/me/keys', null, []);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('read');
  const [token, setToken] = useState(null);
  const [err, setErr] = useState(null);
  const keys = (res.data && res.data.data) || [];
  const origin = window.location.origin;
  const create = async (e) => { e.preventDefault(); setErr(null); try { const r = await api('/me/keys', { method: 'POST', body: { name, scope } }); setToken({ value: r.token, scope: r.data.scope }); setName(''); res.reload(); } catch (x) { setErr(firstError(x)); } };
  const revoke = async (k) => { setErr(null); try { await api('/me/keys/' + k.id, { method: 'DELETE' }); res.reload(); } catch (x) { setErr(firstError(x)); } };
  const mcp = JSON.stringify({ mcpServers: { tidemark: { url: origin + '/api/mcp', headers: { Authorization: 'Bearer ' + (token ? token.value : '<your key>') } } } }, null, 2);
  return html`<${Section} title="API keys" help="Use a key as a Bearer token with the Stats API (/api/v1/stats/…) or to connect an AI assistant through MCP. A read-only key can only read statistics; a full-access key has the same access as you.">
    <form class="goal-add" onSubmit=${create}>
      <div class="seg" role="radiogroup" aria-label="Key access">${[['read', 'Read-only', 'eye'], ['full', 'Full access', 'key']].map(([k, l, i]) => html`<button type="button" role="radio" aria-checked=${scope === k} class=${scope === k ? 'on' : ''} onClick=${() => setScope(k)}><${Icon} name=${i} size=${14} />${l}</button>`)}</div>
      <div class="goal-add-row"><input class="grow" required placeholder="Key name, e.g. Claude or Reporting script" aria-label="Key name" value=${name} onInput=${(e) => setName(e.target.value)} /><button class="btn primary" disabled=${!name.trim()}>Create key</button></div></form>
    ${token && html`<div class="notice"><${Icon} name="key" size=${16} /><div><b>Copy your key now. It won't be shown again.</b><${CodeBlock} text=${token.value} /></div></div>`}
    ${err && html`<div class="alert">${err}</div>`}
    ${res.data && !keys.length && html`<div class="empty-inline"><${Icon} name="key" size=${18} /><div><b>No keys yet</b><span>Create one to read your stats from a script or an AI assistant.</span></div></div>`}
    ${keys.length > 0 && html`<ul class="rows" aria-label="API keys">${keys.map((k) => html`<li class="rowitem">
      <span class="ri-ico" aria-hidden="true"><${Icon} name="key" size=${16} /></span>
      <div class="grow ri-main"><b class="trunc">${k.name}</b><span class="muted">${k.scope === 'read' ? 'Read-only' : 'Full access'} · ${k.last_used_at ? 'last used ' + ago(k.last_used_at.replace('T', ' ').slice(0, 19)) : 'never used'}</span></div>
      <button class="btn ghost icon sm danger" aria-label=${'Revoke key ' + k.name} title="Revoke key" onClick=${() => revoke(k)}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
  <//>
  <${Section} title="Connect an AI assistant" help="Tidemark has a read-only MCP server, so assistants such as Claude can answer questions about your stats. Add this to the assistant's MCP settings with a key from above. It can read totals, trends, top pages and sources, goals and funnels for your sites, and never anything about a single visitor.">
    <${CodeBlock} text=${mcp} />
    <p class="muted small">The Stats API and MCP are described in an <a href="/api/v1/openapi.json" target="_blank" rel="noopener">OpenAPI document</a> you can feed to any API client or code generator.</p>
  <//>`;
}

/** Settings → Teams. A list of teams; opening one shows its people and the sites it can open (the role is chosen per site). */
export function Teams() {
  const { user } = useContext(UserCtx);
  const scope = useScope(user);
  const { query } = useLocation();
  const usable = scope.org && !scope.personal && !scope.shared;
  const res = useApi('/teams', { organization: scope.id }, [scope.id], { enabled: !!usable });
  const teams = (res.data && res.data.data) || [];
  if (!usable) return html`<${NeedsOrganization} scope=${scope} title="Teams" what="Teams group the people in an organization so you can share a site with all of them at once." />`;
  const open = query.team && teams.find((t) => t.id === query.team);
  if (query.team && res.data && !open) navigate('/settings/teams', { replace: true });
  return open ? html`<${TeamDetail} key=${open.id} team=${open} owned=${res.data.owned_sites} canInvite=${!!res.data.invites_enabled} reload=${res.reload} />`
    : html`<${TeamList} res=${res} teams=${teams} org=${scope.org} />`;
}

/** Personal (and "Shared with me") have no admins or teams: say so, and offer the way out, creating an organization. */
function NeedsOrganization({ scope, title, what }) {
  const { setUser } = useContext(UserCtx);
  const [creating, setCreating] = useState(false);
  return html`<${Section} title=${title} help=${scope.shared ? 'Sites shared with you one by one are not part of an organization you belong to.' : 'This is your Personal organization: just you. It has no admins or teams and can\'t be renamed, transferred or deleted.'}>
    <p class="muted small" style="margin:0">${what} To work with other people, switch to an organization in the top bar or create one.</p>
    <div class="section-actions"><button class="btn primary" onClick=${() => setCreating(true)}><${Icon} name="plus" size=${14} /> Create organization</button></div>
  <//>
  ${creating && html`<${CreateOrganization} onClose=${() => setCreating(false)} onCreated=${async (id) => { try { setUser((await api('/me')).user); } catch (e) { /* refreshed on next load */ } scope.set(id); setCreating(false); navigate(pathAfterOrganizationCreated(id)); }} />`}`;
}

const peopleCount = (t) => t.members.length;

function TeamList({ res, teams, org }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const create = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const r = await api('/teams', { method: 'POST', body: { name, organization_id: org.id } }); setName(''); setAdding(false); navigate('/settings/teams?team=' + r.data.id); } catch (x) { setErr(firstError(x)); setBusy(false); }
  };
  return html`<${Section} title="Teams" help=${`Teams in ${org.name}: group people once, then share a site with the whole group as viewers or admins. Adding someone to a team gives them access to every site the team can open.`}>
    ${!adding && html`<div class="section-actions"><button class="btn primary" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${14} /> New team</button></div>`}
    ${adding && html`<form class="goal-add" onSubmit=${create}>${err && html`<div class="alert">${err}</div>`}
      <${Field} label="Team name"><input required autofocus maxlength="80" placeholder="For example Marketing or Client: Acme" value=${name} onInput=${(e) => setName(e.target.value)} /><//>
      <div class="row"><button class="btn primary" disabled=${!name.trim() || busy}>Create team</button><button type="button" class="btn" onClick=${() => { setAdding(false); setErr(null); setName(''); }}>Cancel</button></div></form>`}
    ${res.data && teams.length === 0 && !adding && html`<div class="empty-inline"><${Icon} name="users" size=${18} /><div><b>No teams yet</b><span>Create a team for the people who need the same sites, such as a marketing team or a client's staff, then share your sites with it in one step.</span></div></div>`}
    ${teams.length > 0 && html`<ul class="rows" aria-label="Teams">${teams.map((t) => html`<li class="rowitem pick"><${Link} to=${'/settings/teams?team=' + t.id} class="team-row">
      <span class="avatar" aria-hidden="true"><${Icon} name="users" size=${14} /></span>
      <div class="grow ri-main"><b class="trunc">${t.name}</b><span class="muted trunc">${peopleCount(t)} ${peopleCount(t) === 1 ? 'person' : 'people'} · ${t.sites.length ? `${t.sites.length} ${t.sites.length === 1 ? 'site' : 'sites'}` : 'no sites yet'}${t.invites.length ? ` · ${t.invites.length} waiting to accept` : ''}</span></div>
      <${Icon} name="chevron-right" size=${16} class="muted" /><//></li>`)}</ul>`}
  <//>`;
}

function TeamDetail({ team, owned, canInvite, reload }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState(team.name);
  const [share, setShare] = useState({ domain: '', role: 'viewer' });
  const [err, setErr] = useState(null);
  const [del, setDel] = useState(false);
  const run = async (fn, ok) => { setErr(null); try { await fn(); reload(); if (ok) toast(ok); } catch (x) { setErr(firstError(x)); } };
  const left = (iso) => { const h = Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600000)); return h >= 2 ? `expires in ${h} hours` : 'expires within the hour'; };
  const available = owned.filter((s) => s.organization_id === team.organization_id && !team.sites.some((x) => x.domain === s.domain)).map((s) => s.domain);
  const add = (e) => { e.preventDefault(); run(async () => { const r = await api(`/teams/${team.id}/members`, { method: 'POST', body: { email } }); setEmail(''); toast(r.invited ? 'Invitation sent' : 'Added to the team'); }); };
  const rename = (e) => { e.preventDefault(); run(() => api('/teams/' + team.id, { method: 'PATCH', body: { name } }), 'Team renamed'); };
  const addSite = (e) => { e.preventDefault(); run(async () => { await api(`/sites/${share.domain}/teams`, { method: 'POST', body: { team_id: team.id, role: share.role } }); setShare({ ...share, domain: '' }); }, 'Shared with the team'); };
  const ROLES = [['viewer', 'Viewer'], ['admin', 'Admin']];
  return html`<${Link} to="/settings/teams" class="side-back" style="align-self:flex-start"><${Icon} name="chevron-left" size=${15} /><span>All teams</span><//>
    ${err && html`<div class="alert" role="alert">${err}</div>`}
    <${Section} title="Team name" help=${`${peopleCount(team)} ${peopleCount(team) === 1 ? 'person' : 'people'}, ${team.sites.length ? `${team.sites.length} ${team.sites.length === 1 ? 'site' : 'sites'}` : 'no sites yet'}.`}>
      <form class="goal-add-row" onSubmit=${rename}><input class="grow" required maxlength="80" aria-label="Team name" value=${name} onInput=${(e) => setName(e.target.value)} /><button class="btn" disabled=${!name.trim() || name.trim() === team.name}>Rename</button></form>
    <//>
    <${Section} title="People" help=${canInvite ? 'Everyone here can open the sites below. Someone without an account gets an e-mail invitation that is valid for 72 hours.' : 'Everyone here can open the sites below. Add people who already have an account on this Tidemark install.'}>
      <form class="goal-add" onSubmit=${add}><div class="goal-add-row"><input class="grow" type="email" required placeholder=${canInvite ? 'Email address' : 'Email address of an existing user'} aria-label="Email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><button class="btn primary" disabled=${!email}>${canInvite ? 'Add or invite' : 'Add person'}</button></div></form>
      ${team.members.length + team.invites.length === 0 ? html`<div class="empty-inline"><${Icon} name="user-plus" size=${18} /><div><b>Nobody on this team yet</b><span>Add the people who should get access to the same sites.</span></div></div>`
        : html`<ul class="rows" aria-label=${'People in ' + team.name}>
        ${team.members.map((u) => html`<li class="rowitem"><${Avatar} name=${u.name || u.email} url=${u.avatar_url} /><div class="grow ri-main"><b class="trunc">${u.name}</b><span class="muted trunc">${u.email}</span></div>
          <button class="btn ghost icon sm danger" aria-label=${'Remove ' + u.name + ' from the team'} title="Remove from team" onClick=${() => run(() => api(`/teams/${team.id}/members/${u.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}
        ${team.invites.map((i) => html`<li class="rowitem"><span class="avatar" aria-hidden="true"><${Icon} name="mail" size=${14} /></span><div class="grow ri-main"><b class="trunc">${i.email}</b><span class="muted trunc">Waiting to accept · ${left(i.expires_at)}</span></div>
          <button class="btn ghost sm" disabled=${!canInvite} onClick=${() => run(() => api(`/teams/${team.id}/invites/${i.id}/resend`, { method: 'POST' }), 'Invitation sent again')}>Resend</button>
          <button class="btn ghost icon sm danger" aria-label=${'Cancel invitation for ' + i.email} title="Cancel invitation" onClick=${() => run(() => api(`/teams/${team.id}/invites/${i.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
    <//>
    <${Section} title="Site access" help="What this team can open. Viewers see statistics; admins can also change the site's settings. Someone in several teams, or added to a site directly, gets the strongest role they have.">
      ${available.length > 0 ? html`<form class="goal-add" onSubmit=${addSite}><div class="goal-add-row"><select class="grow" aria-label="Site" value=${share.domain} onChange=${(e) => setShare({ ...share, domain: e.target.value })}><option value="">Share a site with this team…</option>${available.map((d) => html`<option value=${d} selected=${share.domain === d}>${d}</option>`)}</select>
        <div class="seg" role="radiogroup" aria-label="Role">${ROLES.map(([k, l]) => html`<button type="button" role="radio" aria-checked=${share.role === k} class=${share.role === k ? 'on' : ''} onClick=${() => setShare({ ...share, role: k })}>${l}</button>`)}</div>
        <button class="btn primary" disabled=${!share.domain}>Share</button></div></form>`
        : owned.filter((s) => s.organization_id === team.organization_id).length === 0 ? html`<div class="empty-inline"><${Icon} name="globe" size=${18} /><div><b>No sites in this organization yet</b><span>Add a site to the organization, then share it with the team.</span></div></div>` : null}
      ${team.sites.length === 0 && owned.some((s) => s.organization_id === team.organization_id) && html`<div class="empty-inline"><${Icon} name="globe" size=${18} /><div><b>Not shared with any site yet</b><span>Choose a site above to give the team access to it.</span></div></div>`}
      ${team.sites.length > 0 && html`<ul class="rows" aria-label="Sites this team can open">${team.sites.map((s) => html`<li class="rowitem"><span class="ri-ico" aria-hidden="true"><${Icon} name="globe" size=${16} /></span><b class="grow trunc">${s.domain}</b>
        <select class="mini-select" value=${s.role} aria-label=${'Role of ' + team.name + ' on ' + s.domain} onChange=${(e) => run(() => api(`/sites/${s.domain}/teams/${team.id}`, { method: 'PATCH', body: { role: e.target.value } }))}>${ROLES.map(([k, l]) => html`<option value=${k} selected=${s.role === k}>${l}</option>`)}</select>
        <button class="btn ghost icon sm danger" aria-label=${'Stop sharing ' + s.domain} title="Stop sharing this site" onClick=${() => run(() => api(`/sites/${s.domain}/teams/${team.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
    <//>
    <${Section} title="Delete team" danger help="Its members lose the access they only had through this team. Access they have another way stays, and nobody's account is deleted.">
      <div class="section-actions"><button class="btn danger" onClick=${() => setDel(true)}>Delete this team</button></div>
    <//>
    ${del && html`<${Confirm} title=${`Delete the ${team.name} team?`} message="Its members lose the access they only had through this team. Access they have in another way stays." onClose=${() => setDel(false)} onConfirm=${async () => { await api('/teams/' + team.id, { method: 'DELETE' }); navigate('/settings/teams'); }} />`}`;
}

/** Settings → Organization, for the organization chosen in the switcher: name, admins, ownership and deletion for its owner; a read-only view for admins. */
export function Organization() {
  const { user, setUser } = useContext(UserCtx);
  const scope = useScope(user);
  const offers = useApi('/organizations', null, []);
  const usable = scope.org && !scope.personal && !scope.shared;
  const res = useApi(usable ? '/organizations/' + scope.id : '', null, [scope.id], { enabled: !!usable });
  const org = res.data;
  const incoming = (offers.data && offers.data.incoming_transfers) || [];
  const [name, setName] = useState(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState(null);
  const [transfer, setTransfer] = useState(false);
  const [del, setDel] = useState(false);
  const [leave, setLeave] = useState(false);
  const refreshMe = async () => { try { setUser((await api('/me')).user); } catch (e) { /* refreshed on next load */ } };
  const run = async (fn, ok) => { setErr(null); try { await fn(); res.reload(); if (ok) toast(ok); } catch (x) { setErr(firstError(x)); } };
  const left = (iso) => { const h = Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600000)); return h >= 2 ? `expires in ${h} hours` : 'expires within the hour'; };
  const base = '/organizations/' + scope.id;
  const add = (e) => { e.preventDefault(); run(async () => { const r = await api(base + '/admins', { method: 'POST', body: { email } }); setEmail(''); toast(r.invited ? 'Invitation sent' : 'Added as an admin'); }); };
  const offerBanners = incoming.map((o) => html`<div class="notice"><${Icon} name="info" size=${16} /><div><b>${o.from} wants to make you the owner of ${o.name}.</b> You would hold its plan and billing and decide who its admins are; ${o.from} stays on as an admin. This offer ${left(o.expires_at)}.
    <div class="row" style="margin-top:8px"><button class="btn primary sm" onClick=${() => run(async () => { await api(`/organizations/${o.id}/transfer/accept`, { method: 'POST' }); await refreshMe(); offers.reload(); }, 'You are the owner now')}>Accept ownership</button>
    <button class="btn sm" onClick=${() => run(async () => { await api(`/organizations/${o.id}/transfer/decline`, { method: 'POST' }); offers.reload(); }, 'Offer declined')}>Decline</button></div></div></div>`);
  if (!usable) return html`${offerBanners}<${NeedsOrganization} scope=${scope} title="Organization" what="Organizations have a name, an owner, admins and teams; they hold sites for a company, a team or a client." />`;
  if (res.loading && !res.data) return html`<${Loading} />`;
  if (!org) return html`${offerBanners}<${ErrorBox} error=${res.error} />`;
  const owner = org.role === 'owner';
  const canInvite = !!org.invites_enabled;
  return html`${err && html`<div class="alert" role="alert">${err}</div>`}${offerBanners}
    ${owner ? html`<${Section} title="Organization name" help="Shown to the people you invite and to anyone you give access to. You are its owner.">
      <${ImageField} label="Logo" name=${org.name} url=${org.logo_url} shape="org" path=${base + '/logo'} type="image/png" onChange=${async () => { await refreshMe(); res.reload(); }} hint="Helps you and your colleagues tell organizations apart in the switcher. Cropped to a square; PNG, JPEG or WebP." />
      <form class="goal-add-row" onSubmit=${(e) => { e.preventDefault(); run(async () => { await api(base, { method: 'PATCH', body: { name: name === null ? org.name : name } }); await refreshMe(); }, 'Name saved'); }}><input class="grow" required maxlength="100" aria-label="Organization name" value=${name === null ? org.name : name} onInput=${(e) => setName(e.target.value)} /><button class="btn" disabled=${name === null || !name.trim() || name.trim() === org.name}>Save</button></form>
    <//>` : html`<${Section} title=${org.name} help=${`You are an admin of this organization. You see and change every site in it, add sites and manage its teams. ${org.owner ? org.owner.name : 'The owner'} keeps billing, the admin list and the organization itself.`}>
      <div class="section-actions"><button class="btn danger" onClick=${() => setLeave(true)}>Leave organization</button></div>
    <//>`}
    <${Section} title="Admins" help=${owner ? 'Admins help you run the organization. They can see and change every site in it, add and delete sites, and manage its teams. Billing, the organization itself and who else is an admin stay with you, the owner.' + (canInvite ? ' Someone without an account gets an e-mail invitation that is valid for 72 hours.' : '') : 'People who help run this organization with its owner.'}>
      ${owner && html`<form class="goal-add" onSubmit=${add}><div class="goal-add-row"><input class="grow" type="email" required placeholder=${canInvite ? 'Email address' : 'Email address of an existing user'} aria-label="Email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><button class="btn primary" disabled=${!email}>${canInvite ? 'Add or invite' : 'Add person'}</button></div></form>`}
      ${org.admins.length + org.invites.length === 0 && html`<div class="empty-inline"><${Icon} name="shield" size=${18} /><div><b>${owner ? 'Only you manage this organization' : 'No other admins'}</b>${owner && html`<span>Add a colleague to give them the same view of every site, without sharing each one.</span>`}</div></div>`}
      ${org.admins.length + org.invites.length > 0 && html`<ul class="rows" aria-label="Organization admins">
        ${org.admins.map((u) => html`<li class="rowitem"><${Avatar} name=${u.name || u.email} url=${u.avatar_url} /><div class="grow ri-main"><b class="trunc">${u.name}</b>${(u.email || (org.transfer && org.transfer.to.id === u.id)) && html`<span class="muted trunc">${u.email || ''}${org.transfer && org.transfer.to.id === u.id ? ' · ownership offered' : ''}</span>`}</div>
          ${owner && html`<button class="btn ghost icon sm danger" aria-label=${'Remove ' + u.name + ' as an admin'} title="Remove as admin" onClick=${() => run(() => api(`${base}/admins/${u.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button>`}</li>`)}
        ${org.invites.map((i) => html`<li class="rowitem"><span class="avatar" aria-hidden="true"><${Icon} name="mail" size=${14} /></span><div class="grow ri-main"><b class="trunc">${i.email}</b><span class="muted trunc">Waiting to accept · ${left(i.expires_at)}</span></div>
          <button class="btn ghost sm" disabled=${!canInvite} onClick=${() => run(() => api(`${base}/invites/${i.id}/resend`, { method: 'POST' }), 'Invitation sent again')}>Resend</button>
          <button class="btn ghost icon sm danger" aria-label=${'Cancel invitation for ' + i.email} title="Cancel invitation" onClick=${() => run(() => api(`${base}/invites/${i.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
    <//>
    ${owner && html`<${Section} title="Transfer ownership" danger help="Hand the organization to one of its admins. They have to accept, and you stay on as an admin. They then hold the plan and billing and decide who the admins are.">
      ${org.transfer ? html`<div class="notice"><${Icon} name="info" size=${16} /><div>Waiting for <b>${org.transfer.to.name}</b> to accept. The offer ${left(org.transfer.expires_at)}.</div></div>
        <div class="section-actions"><button class="btn" onClick=${() => run(() => api(base + '/transfer', { method: 'DELETE' }), 'Offer cancelled')}>Cancel the offer</button></div>`
        : org.admins.length === 0 ? html`<p class="muted small">Add an admin above first: ownership can only go to one of the organization's admins.</p>`
        : html`<div class="section-actions"><button class="btn danger" onClick=${() => setTransfer(true)}>Transfer ownership…</button></div>`}
    <//>
    <${Section} title="Delete organization" danger help="Removes the organization, its teams and its admin list. Its sites have to be deleted or moved first, so nothing goes by accident.">
      <div class="section-actions"><button class="btn danger" onClick=${() => setDel(true)}>Delete organization…</button></div>
    <//>`}
    ${transfer && html`<${TransferDialog} org=${org} base=${base} onClose=${() => setTransfer(false)} onDone=${() => { setTransfer(false); res.reload(); toast('Offer sent'); }} />`}
    ${del && html`<${TypedConfirm} title=${`Delete ${org.name}?`} message=${org.sites ? `It still has ${org.sites} ${org.sites === 1 ? 'site' : 'sites'}: delete them first.` : 'Its teams and admin list are removed. This cannot be undone.'} phrase=${org.name} confirmLabel="Delete organization" onClose=${() => setDel(false)} onConfirm=${async () => { await api(base, { method: 'DELETE', body: { confirm: org.name } }); await refreshMe(); scope.set(''); navigate('/sites'); }} />`}
    ${leave && html`<${Confirm} title=${`Leave ${org.name}?`} message="You lose access to its sites unless they were also shared with you directly." confirmLabel="Leave" onClose=${() => setLeave(false)} onConfirm=${async () => { await api(base + '/leave', { method: 'POST' }); await refreshMe(); scope.set(''); navigate('/sites'); }} />`}`;
}

function TransferDialog({ org, base, onClose, onDone }) {
  const [to, setTo] = useState(org.admins[0].id);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); setErr(null); setBusy(true); try { await api(base + '/transfer', { method: 'POST', body: { user_id: to, confirm } }); onDone(); } catch (x) { setErr(firstError(x)); setBusy(false); } };
  return html`<${Modal} title="Transfer ownership" onClose=${onClose} footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn destructive" form="transfer-form" disabled=${busy || confirm.trim().toLowerCase() !== org.name.toLowerCase()}>${busy ? 'Sending…' : 'Send the offer'}</button>`}>
    <form id="transfer-form" class="stack" onSubmit=${send}>
      ${err && html`<div class="alert" role="alert">${err}</div>`}
      <p style="line-height:1.55;color:var(--muted-foreground)">Nothing changes until they accept. After that they own <b>${org.name}</b> and hold its plan and billing; you stay on as an admin and can be removed by them.</p>
      <${Field} label="New owner"><select value=${to} onChange=${(e) => setTo(e.target.value)}>${org.admins.map((u) => html`<option value=${u.id} selected=${to === u.id}>${u.name} (${u.email})</option>`)}</select><//>
      <${Field} label=${`Type ${org.name} to confirm`}><input autocomplete="off" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} /><//>
    </form><//>`;
}

export function Users() {
  const { user } = useContext(UserCtx);
  const res = useApi('/admin/users', null, []);
  const blank = { name: '', email: '', password: '', is_admin: false };
  const [f, setF] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);
  const [del, setDel] = useState(null);
  const users = (res.data && res.data.data) || [];
  const add = async (e) => { e.preventDefault(); setErr(null); try { await api('/admin/users', { method: 'POST', body: f }); setF(blank); setAdding(false); res.reload(); toast('User created'); } catch (x) { setErr(firstError(x)); } };
  return html`<${Section} title="Users" help="People who can sign in to this Tidemark install. Give them access to a site under that site's Sharing and access settings.">
      ${!adding && html`<div class="section-actions"><button class="btn primary" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${14} /> New user</button></div>`}
      ${adding && html`<form class="goal-add" onSubmit=${add}>${err && html`<div class="alert">${err}</div>`}
        <div class="fields2"><${Field} label="Name"><input required autofocus value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /><//><${Field} label="Email"><input type="email" required value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /><//></div>
        <${Field} label="Temporary password" help="At least 8 characters. They can change it after signing in." class="tzfield"><input type="password" required minlength="8" autocomplete="new-password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /><//>
        <${Toggle} label="Administrator" help="Can manage users and every site." checked=${f.is_admin} onChange=${(v) => setF({ ...f, is_admin: v })} />
        <div class="row"><button class="btn primary">Create user</button><button type="button" class="btn" onClick=${() => { setAdding(false); setErr(null); setF(blank); }}>Cancel</button></div></form>`}
      ${users.length > 0 && html`<ul class="rows" aria-label="Users">${users.map((u) => html`<li class="rowitem">
        <span class="avatar" aria-hidden="true">${initial(u)}</span>
        <div class="grow ri-main"><b class="trunc">${u.name} ${u.id === user.id && html`<span class="muted">(you)</span>`}</b><span class="muted trunc">${u.email}</span></div>
        <span class="muted small nowrap">${u.sites_count} ${u.sites_count === 1 ? 'site' : 'sites'}</span>
        ${u.is_admin ? html`<span class="pill brand">Admin</span>` : html`<span class="pill">Member</span>`}
        ${u.id !== user.id ? html`<button class="btn ghost icon sm danger" aria-label=${'Delete ' + u.name} title="Delete user" onClick=${() => setDel(u)}><${Icon} name="trash-2" size=${15} /></button>` : html`<span class="ri-spacer" aria-hidden="true"></span>`}</li>`)}</ul>`}
    <//>
    ${del && html`<${Confirm} title=${`Delete ${del.name}?`} message="Their account and API keys are removed. Sites they own keep their data." onClose=${() => setDel(null)} onConfirm=${async () => { await api('/admin/users/' + del.id, { method: 'DELETE' }); res.reload(); }} />`}`;
}

const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

export function Updates() {
  const { setUser } = useContext(UserCtx);
  const refreshUser = async () => { try { setUser((await api('/me')).user); } catch (e) { /* keep the current state */ } };
  const res = useApi('/admin/update', null, []);
  const info = res.data;
  const [progress, setProgress] = useState(null);
  const [staged, setStaged] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [fetching, setFetching] = useState(false);
  const check = useApi('/admin/update/check', null, []);
  const latest = check.data && check.data.latest;
  const pending = staged || (info && info.staged);

  const upload = async (file) => {
    if (!file) return;
    setErr(null); setStaged(null); setDone(null);
    const size = info.limits.chunk, total = Math.max(1, Math.ceil(file.size / size)), id = uuid();
    try {
      for (let i = 0; i < total; i++) {
        setProgress(Math.round((i / total) * 100));
        const fd = new FormData();
        fd.append('id', id); fd.append('index', i); fd.append('total', total);
        fd.append('chunk', file.slice(i * size, (i + 1) * size), 'chunk.bin');
        const r = await api('/admin/update/chunk', { method: 'POST', body: fd });
        if (r.done) setStaged(r.staged);
      }
    } catch (x) { setErr(x.body && x.body.error ? x.body.error : firstError(x)); }
    setProgress(null);
  };
  const install = async (force) => {
    setBusy(true); setErr(null);
    try {
      const r = await api('/admin/update/apply', { method: 'POST', body: { force } });
      const after = await api('/admin/update'); // the first request after the copy runs the migrations
      setDone({ ...r.result, last: after.last });
      setStaged(null);
      res.reload();
      refreshUser();
    } catch (x) { setErr(x.body && x.body.error ? x.body.error : firstError(x)); }
    setBusy(false);
  };
  const downloadAndInstall = async () => {
    setFetching(true); setErr(null);
    try {
      const r = await api('/admin/update/download', { method: 'POST' });
      const after = await api('/admin/update');
      setDone({ ...r.result, last: after.last });
      res.reload();
      refreshUser();
    } catch (x) { setErr(x.body && x.body.error ? x.body.error : firstError(x)); }
    setFetching(false);
  };
  const discard = async () => { await api('/admin/update', { method: 'DELETE' }); setStaged(null); res.reload(); };

  if (!info) return html`<${Loading} />`;
  return html`<${Section} title="Software updates" help="Upload a Tidemark release zip to update this installation. Your data, settings and .env file are never touched.">
      <div class="row spread wrap"><div><span class="muted">Installed version</span><div style="font-size:22px;font-weight:620;letter-spacing:-0.02em">${info.version}</div></div></div>
      ${!info.zip && html`<div class="alert">PHP's zip extension is missing on this server, so updates can't be installed here.</div>`}
      ${info.zip && !info.writable && html`<div class="alert">The application folder isn't writable by PHP. Fix the permissions, or upload the new release over FTP instead.</div>`}
      ${err && html`<div class="alert" role="alert">${err}</div>`}
      ${done && html`<div class="notice"><${Icon} name="circle-check" size=${16} /><div><b>Updated from ${done.from} to ${done.to}.</b> ${done.files} files replaced${done.removed ? `, ${done.removed} obsolete files removed` : ''}.
        ${done.last && done.last.ok === false ? html`<div class="alert" style="margin-top:8px">Migrations failed: ${done.last.error}. A backup of the previous version is in storage/app/updates/backups.</div>` : html`<span> Database migrations ran.</span>`}
        <div style="margin-top:8px"><button class="btn sm" onClick=${() => location.reload()}>Reload to use the new version</button></div></div></div>`}
      ${info.zip && info.writable && !done && !pending && html`<div class="autoupdate">${check.loading && !latest ? html`<span class="muted">Checking GitHub for updates…</span>`
        : latest && latest.newer ? html`<div class="row spread wrap"><div class="grow"><b>Tidemark Analytics  is available</b>${latest.published_at && html`<span class="muted"> · ${new Date(latest.published_at).toLocaleDateString()}</span>`}
            ${latest.notes && html`<pre class="notes">${latest.notes.slice(0, 1200)}</pre>`}<a class="muted" href=${latest.url} target="_blank" rel="noopener">Release notes on GitHub</a></div>
            <button class="btn primary" disabled=${fetching} onClick=${downloadAndInstall}>${fetching ? 'Downloading…' : 'Download and install'}</button></div>`
        : latest ? html`<div class="row spread wrap"><span><${Icon} name="circle-check" size=${14} class="check" /> You're on the latest version (${latest.version}).</span><button class="btn sm" disabled=${check.loading} onClick=${() => api('/admin/update/check', { params: { fresh: 1 } }).then(check.reload)}>Check again</button></div>`
        : html`<div class="row spread wrap"><span class="muted">${(check.data && check.data.error) || 'Could not check for updates.'}</span><button class="btn sm" onClick=${check.reload}>Try again</button></div>`}</div>`}
      ${info.zip && info.writable && !done && (pending ? html`<div class="stage"><div class="grow"><b>Tidemark Analytics </b> is ready to install.<div class="muted">${pending.newer ? `You're on ${pending.current}.` : `You're already on ${pending.current}; this is not a newer release.`} A backup of the current files is made first.</div></div>
          <div class="row"><button class="btn" disabled=${busy} onClick=${discard}>Discard</button><button class="btn primary" disabled=${busy} onClick=${() => install(!pending.newer)}>${busy ? 'Installing…' : pending.newer ? 'Install update' : 'Install anyway'}</button></div></div>`
        : html`<label class="dropzone ${progress !== null ? 'busy' : ''}"><${Icon} name="download" size=${20} /><b>${progress !== null ? `Uploading… ${progress}%` : 'Or upload a release zip yourself'}</b><span class="muted">tidemark-x.y.z.zip · sent in ${mb(info.limits.chunk)} pieces, so your host's ${mb(info.limits.upload || info.limits.chunk)} upload limit is fine</span>
          <input type="file" accept=".zip,application/zip" disabled=${progress !== null} onChange=${(e) => upload(e.target.files[0])} />${progress !== null && html`<span class="bar"><i style=${`width:${progress}%`}></i></span>`}</label>`)}
      ${info.auto_check && html`<p class="muted small">Tidemark looks for new releases every few hours${info.last_check && !info.last_check.error ? `, last on ${new Date(info.last_check.checked_at * 1000).toLocaleDateString()}` : ''}, and shows a dot next to your profile when one is available. Only the latest version number is requested from GitHub. Turn this off with <code>TIDEMARK_UPDATE_CHECK=false</code>.</p>`}
      ${info.last && !done && html`<p class="muted">Last update: ${info.last.from} → ${info.last.to}, ${new Date(info.last.finished_at * 1000).toLocaleString()}.</p>`}
    <//>`;
}

export function AccountSettings({ tab }) {
  useDocTitle('Settings');
  const { user } = useContext(UserCtx);
  const extra = registry.accountTabs.filter((x) => !x.visible || x.visible(user));
  const tabs = accountTabs(user);
  // administration lives in its own interface when an extension provides one
  if (registry.adminUi && user.is_admin && ['users', 'updates', 'customers'].includes(tab)) { window.location.replace(registry.adminUi.href + (tab === 'customers' ? '' : '/' + tab)); return null; }
  const moved = { preferences: 'profile' }; // older links still land in the right place
  const t = [tab, moved[tab]].find((k) => tabs.some((x) => x[0] === k)) || 'profile';
  const Body = { profile: Profile, reports: EmailReports, security: Security, keys: ApiKeys, teams: Teams, organization: Organization, users: Users, updates: Updates, ...Object.fromEntries(extra.map((x) => [x.key, x.component])) }[t];
  return html`<${SettingsShell} title="Settings" back=${['/sites', 'Your sites']} scope="Sites" dup tabs=${tabs} tab=${t} base="/settings"><${Body} /><//>`;
}
