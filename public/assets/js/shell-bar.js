// Shell: Top bar: account and help menus, organization and site switchers, live visitors.
import { html, useState, useEffect, useMemo, useRef, useApi, api, navigate, Link, Icon, fmt, BASE, UserCtx, useContext, setTheme, currentTheme, countryName, flag } from './lib.js';
import { Pop, Sheet, FavTile, Modal, Field, Avatar } from './ui.js';
import { useScope } from './org.js';
import { Logo } from './logo.js';
import { registry, pathAfterOrganizationCreated, badgeOf, badgeText, useBadgeCounts } from './extensions.js';
import { SITE_NAV, modKey, openPalette, openShortcuts, siteFromPath } from './shell-nav.js';
import { useRecents } from './shell-state.js';

/** `compact` is kept for older callers; the account menu is the same everywhere now. */
export function AccountMenu({ user, align = 'right', btnClass = 'btn ghost avatar-btn', named }) {
  const [theme, setT] = useState(currentTheme());
  const pick = (t) => { setTheme(t); setT(t); };
  return html`<${Pop} align=${align} ariaLabel="Account menu" btnClass=${btnClass} label=${html`<${Avatar} name=${user.name} url=${user.avatar_url} />${named && html`<span class="who-name"><b>${user.name}</b><span>${user.email}</span></span>`}${user.update && html`<span class="notif on-avatar" aria-hidden="true"></span><span class="sr-only">Update available</span>`}`}>
    ${(close) => html`<div style="min-width:240px"><div class="who"><b>${user.name}</b><span class="muted">${user.email}</span></div><hr />
      <${Link} to="/sites" class="item" onClick=${close}><span>Your sites</span><${Icon} name="globe" size=${14} /><//>
      <${Link} to="/settings" class="item" onClick=${close}><span>Settings${user.update && html`<span class="notif inline" aria-hidden="true"></span><span class="sr-only"> (update available)</span>`}</span><${Icon} name="settings" size=${14} /><//>
      ${user.is_admin && registry.adminUi && html`<a class="item" href=${BASE + registry.adminUi.href} onClick=${close}><span>${registry.adminUi.label}</span><${Icon} name="shield-check" size=${14} /></a>`}
      ${registry.menuItems.filter((m) => !m.help && (!m.visible || m.visible(user))).map((m) => (m.onClick
        ? html`<button class="item" onClick=${() => { close(); m.onClick(); }}><span>${m.label}</span><${Icon} name=${m.icon || 'external-link'} size=${14} /></button>`
        : html`<a class="item" href=${m.href} target=${m.external ? '_blank' : null} rel=${m.external ? 'noopener' : null} onClick=${close}><span>${m.label}</span><${Icon} name=${m.icon || 'external-link'} size=${14} /></a>`))}
      <hr /><div class="grp" id="theme-label">Theme</div>
      <div class="theme-seg" role="radiogroup" aria-labelledby="theme-label">${[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'System', 'monitor']].map(([k, l, i]) => html`<button type="button" role="radio" aria-checked=${theme === k} aria-label=${l} title=${l} class=${theme === k ? 'on' : ''} onClick=${() => pick(k)}><${Icon} name=${i} size=${15} /></button>`)}</div>
      <hr />
      <button class="item" onClick=${async () => { close(); await api('/auth/logout', { method: 'POST' }); window.location.assign(window.SD.base + '/login'); }}><span>Sign out</span><${Icon} name="log-out" size=${14} /></button></div>`}<//>`;
}

/** The count beside a menu entry that has a `badge`, with its text for screen readers. */
export const BadgeCount = ({ m }) => { const n = badgeOf(m); return n > 0 && html`<em class="side-count warn" aria-hidden="true">${n}</em><span class="sr-only"> (${badgeText(m, n)})</span>`; };

function HelpMenu({ user }) {
  const dot = useBadgeCounts();
  const items = registry.menuItems.filter((m) => m.help && (!m.visible || m.visible(user)));
  return html`<${Pop} align="right" ariaLabel=${dot ? 'Help (something needs your attention)' : 'Help'} btnClass="btn ghost icon help-btn" label=${html`<${Icon} name="circle-help" size=${17} />${dot && html`<span class="notif on-avatar" aria-hidden="true"></span>`}`}>
    ${(close) => html`<div style="min-width:220px">
      <a class="item" href="https://hellotidemark.com/analytics/docs/" target="_blank" rel="noopener" onClick=${close}><span>Documentation</span><${Icon} name="book-open" size=${14} /></a>
      ${items.map((m) => (m.onClick
        ? html`<button class="item" onClick=${() => { close(); m.onClick(); }}><span>${m.label}</span><${BadgeCount} m=${m} /><${Icon} name=${m.icon || 'external-link'} size=${14} /></button>`
        : html`<a class="item" href=${m.href} target=${m.external ? '_blank' : null} rel=${m.external ? 'noopener' : null} onClick=${close}><span>${m.label}</span><${BadgeCount} m=${m} /><${Icon} name=${m.icon || 'external-link'} size=${14} /></a>`))}
      <button class="item" onClick=${() => { close(); openShortcuts(); }}><span>Keyboard shortcuts</span><kbd>?</kbd></button>
      <a class="item" href="https://community.tidemarkanalytics.com" target="_blank" rel="noopener" onClick=${close}><span>Community</span><${Icon} name="users" size=${14} /></a></div>`}<//>`;
}

/** Organization switcher: the organizations you belong to (Personal first), sites shared with you one by one, and a way to create one. */
export function OrgSwitcher({ user }) {
  const { setUser } = useContext(UserCtx);
  const scope = useScope(user);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrap = useRef();
  useEffect(() => {
    if (!open) return;
    const out = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!scope.orgs.length) return null;
  const pick = (id) => { setOpen(false); scope.set(id); if (location.pathname !== '/sites' && !location.pathname.startsWith('/settings')) navigate('/sites'); };
  const label = scope.shared ? 'Shared with me' : scope.org.personal ? 'Personal' : scope.org.name;
  const tile = (name, url) => html`<${Avatar} name=${name} url=${url} size="sm" shape="org" />`;
  return html`<div class="pop-wrap org-sw" ref=${wrap}>
    <button class=${'crumb-btn' + (open ? ' open' : '')} aria-haspopup="menu" aria-expanded=${open} aria-label=${'Switch organization, current: ' + label} onClick=${() => setOpen(!open)}>
      ${tile(scope.shared ? 'S' : scope.org.name, scope.shared ? null : scope.org.logo_url)}<span class="trunc">${label}</span><${Icon} name="chevrons-up-down" size=${14} class="chev" />
    </button>
    ${open && html`<div class="switch-pop" role="menu" aria-label="Organizations">
      <div class="cmd-list">
        <div class="grp">Organizations</div>
        ${scope.orgs.map((o) => html`<button class=${'cmd-item' + (!scope.shared && o.id === scope.id ? ' on' : '')} role="menuitemradio" aria-checked=${!scope.shared && o.id === scope.id} onClick=${() => pick(o.id)}>
          ${tile(o.name, o.logo_url)}<span class="trunc">${o.personal ? 'Personal' : o.name}</span>${o.personal && html`<span class="pill">You</span>`}${!scope.shared && o.id === scope.id && html`<${Icon} name="check" size=${14} class="tick" />`}</button>`)}
        ${user.shared_sites && html`<div class="grp">Others</div>
          <button class=${'cmd-item' + (scope.shared ? ' on' : '')} role="menuitemradio" aria-checked=${scope.shared} onClick=${() => pick('shared')}>${tile('S')}<span class="trunc">Shared with me</span>${scope.shared && html`<${Icon} name="check" size=${14} class="tick" />`}</button>`}
      </div>
      <div class="cmd-foot"><button class="cmd-item" role="menuitem" onClick=${() => { setOpen(false); setCreating(true); }}><${Icon} name="plus" size=${15} /><span>Create organization</span></button></div>
    </div>`}
    ${creating && html`<${CreateOrganization} onClose=${() => setCreating(false)} onCreated=${async (id) => { try { const me = await api('/me'); setUser(me.user); } catch (e) { /* the switcher refreshes on the next load */ } scope.set(id); setCreating(false); navigate(pathAfterOrganizationCreated(id)); }} />`}
  </div>`;
}

export function CreateOrganization({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const r = await api('/organizations', { method: 'POST', body: { name } }); await onCreated(r.data.id); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); setBusy(false); }
  };
  return html`<${Modal} title="Create an organization" onClose=${onClose} footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" form="create-org-form" disabled=${busy || !name.trim()}>${busy ? 'Creating…' : 'Create organization'}</button>`}>
    <form id="create-org-form" class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert" role="alert">${err}</div>`}
      <p style="line-height:1.55;color:var(--muted-foreground)">An organization holds sites for a company, a team or a client. You can add admins and teams to it, and give it to someone else later. Your Personal organization stays just for you.</p>
      <${Field} label="Name"><input required autofocus maxlength="100" placeholder="For example Acme Studio" value=${name} onInput=${(e) => setName(e.target.value)} /><//>
    </form><//>`;
}

/** Breadcrumb switcher: search, recents, then sites and rollups in their own groups. */
function SiteSwitcher({ list, current, domain, recents, user, scopeId }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const wrap = useRef();
  const input = useRef();
  const trigger = useRef();
  const query = q.trim().toLowerCase();
  const orgs = (user && user.organizations) || [];
  // which organization a site belongs to, for the label next to it and for grouping; sites of other people's organizations are "Shared with me"
  const orgOf = (s) => { const o = orgs.find((x) => x.id === s.organization_id); return o ? { id: o.id, name: o.personal ? 'Personal' : o.name } : { id: 'shared', name: 'Shared with me' }; };
  const groups = useMemo(() => {
    if (query) return [['Results', list.filter((s) => s.domain.toLowerCase().includes(query))]];
    const byDomain = Object.fromEntries(list.map((s) => [s.domain, s]));
    const recent = recents.map((d) => byDomain[d]).filter((s) => s && s.domain !== domain).slice(0, 3);
    // the current organization's sites first, then the others (Personal first), then what is shared with you
    const order = [scopeId, ...orgs.map((o) => o.id), 'shared'].filter((id, i, all) => id && all.indexOf(id) === i);
    const byOrg = order.map((id) => [orgs.find((o) => o.id === id) ? orgOf({ organization_id: id }).name : 'Shared with me', list.filter((s) => orgOf(s).id === id)]);
    return [['Recent', recent], ...byOrg].filter(([, l]) => l.length);
  }, [list, query, recents, domain, scopeId, user]);
  const flat = groups.flatMap(([, l]) => l);
  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0);
    setTimeout(() => input.current && input.current.focus(), 0);
    const out = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  useEffect(() => setSel(0), [q]);
  const close = () => { setOpen(false); trigger.current && trigger.current.focus(); };
  const pick = (s) => { setOpen(false); navigate('/' + s.domain + (location.pathname.includes('/' + domain + '/settings') ? '/settings' : '')); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((n) => Math.min(flat.length - 1, n + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((n) => Math.max(0, n - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); pick(flat[sel]); }
  };
  let n = -1;
  return html`<div class="pop-wrap" ref=${wrap}>
    <button ref=${trigger} class=${'crumb-btn' + (open ? ' open' : '')} aria-haspopup="dialog" aria-expanded=${open} aria-label=${'Switch site, current: ' + domain} onClick=${() => setOpen(!open)}>
      <${FavTile} name=${domain} rollup=${current && current.rollup} size="sm" /><span class="trunc">${domain}</span><${Icon} name="chevrons-up-down" size=${14} class="chev" />
    </button>
    ${open && html`<div class="switch-pop" role="dialog" aria-label="Switch site">
      <div class="cmd-in"><${Icon} name="search" size=${15} /><input ref=${input} value=${q} placeholder="Find site…" role="combobox" aria-expanded="true" aria-controls="switch-list" aria-activedescendant=${flat[sel] ? 'sw-' + sel : undefined} aria-label="Find site" onInput=${(e) => setQ(e.target.value)} onKeyDown=${onKey} /></div>
      <div class="cmd-list" id="switch-list" role="listbox" aria-label="Sites">${flat.length === 0 ? html`<div class="cmd-empty">No site matches “${q}”</div>` : groups.map(([label, items]) => html`<div role="group" aria-label=${label}><div class="grp" aria-hidden="true">${label}</div>${items.map((s) => { n++; const i = n; return html`<button id=${'sw-' + i} tabindex="-1" role="option" aria-selected=${s.domain === domain} class=${'cmd-item ' + (i === sel ? 'on' : '')} onMouseMove=${() => setSel(i)} onClick=${() => pick(s)}>
        <${FavTile} name=${s.domain} rollup=${s.rollup} size="sm" /><span class="trunc">${s.domain}</span>${(label === 'Recent' || label === 'Results') && orgs.length > 1 && html`<span class="muted small trunc" style="margin-left:auto;max-width:34%">${orgOf(s).name}</span>`}${s.domain === domain && html`<${Icon} name="check" size=${14} class="tick" />`}</button>`; })}</div>`)}</div>
      <div class="cmd-foot"><button class="cmd-item" onClick=${() => { setOpen(false); navigate('/sites'); }}><${Icon} name="layout-dashboard" size=${15} /><span>All sites</span></button>
        <button class="cmd-item" onClick=${() => { setOpen(false); navigate('/sites/new'); }}><${Icon} name="plus" size=${15} /><span>New site</span></button></div>
    </div>`}
  </div>`;
}

function LiveSheet({ domain, count, onClose }) {
  const pages = useApi(`/sites/${domain}/stats/breakdown/page`, { period: 'realtime', limit: 8 }, [domain]);
  const countries = useApi(`/sites/${domain}/stats/breakdown/country`, { period: 'realtime', limit: 8 }, [domain]);
  const List = ({ res, label, render }) => {
    const rows = (res.data && res.data.results) || [];
    const max = Math.max(1, ...rows.map((r) => r.visitors));
    return html`<section class="stack sm" style="margin-top:20px"><h3>${label}</h3>${res.loading && !res.data ? html`<div class="skeleton" style="height:96px"></div>` : rows.length === 0 ? html`<p class="muted small">Nobody in the last 30 minutes.</p>`
      : html`<div class="mlist">${rows.map((r) => html`<div class="mrow static"><span class="bar" style=${`width:${(r.visitors / max) * 100}%`}></span><span class="l"><span class="t">${render(r)}</span></span><span class="r">${fmt(r.visitors)}</span></div>`)}</div>`}</section>`;
  };
  return html`<${Sheet} title="Live visitors" description="Activity on ${domain} in the last 30 minutes." onClose=${onClose}
    footer=${html`<button class="btn" onClick=${onClose}>Close</button><button class="btn primary" onClick=${() => { onClose(); navigate(`/${domain}?period=realtime`); }}>Open realtime view</button>`}>
    <div class="row" style="gap:12px"><span class=${'dot ' + (count ? '' : 'off')}></span><span style="font-size:28px;font-weight:600;letter-spacing:-0.03em" class="num">${count === null ? '…' : fmt(count)}</span><span class="muted">${count === 1 ? 'visitor right now' : 'visitors right now'}</span></div>
    <${List} res=${pages} label="Current pages" render=${(r) => r.name} />
    <${List} res=${countries} label="Countries" render=${(r) => html`${flag(r.name)} ${countryName(r.name)}`} />
  <//>`;
}

export function LivePill({ domain }) {
  const res = useApi(`/sites/${domain}/stats/current-visitors`, {}, [domain], { poll: 30000 });
  const [open, setOpen] = useState(false);
  const n = res.data ? res.data.visitors : null;
  return html`<button class="live-pill" onClick=${() => setOpen(true)} aria-haspopup="dialog" title="Live visitors"><span class=${'dot ' + (n ? '' : 'off')} aria-hidden="true"></span><span class="num">${n === null ? '…' : fmt(n)}</span><span class="muted">${n === 1 ? 'visitor' : 'visitors'}<span class="sr-only"> online now</span></span></button>
    ${open && html`<${LiveSheet} domain=${domain} count=${n} onClose=${() => setOpen(false)} />`}`;
}

function sectionLabel(path, domain) {
  if (domain) {
    const rest = path.slice(domain.length + 1);
    if (rest.startsWith('/installation')) return 'Installation';
    const item = SITE_NAV.find((i) => i.route && rest.startsWith(i.route));
    return item ? item.label : 'Overview';
  }
  if (path === '/sites') return 'Sites';
  if (path === '/sites/new') return 'New site';
  if (path === '/sites/rollup') return 'New rollup';
  if (path.startsWith('/settings')) return 'Settings';
  const seg = (path.split('/')[1] || '');
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Sites';
}

/** The signed-in top bar: [logo] / [site switcher] / [section], then Find, live visitors, help and the account menu. */
export function AppBar({ user, path, sites, side }) {
  const domain = siteFromPath(path);
  const current = domain ? sites.list.find((s) => s.domain === domain) : null;
  const recents = useRecents(domain);
  const scope = useScope(user);
  // opening a site puts the organization switcher on the organization that site belongs to
  useEffect(() => {
    if (!current) return;
    const mine = (user.organizations || []).find((o) => (current.rollup ? o.personal : o.id === current.organization_id));
    const target = mine ? mine.id : user.shared_sites ? 'shared' : null;
    if (target && target !== scope.id) scope.set(target);
  }, [current && current.id, current && current.organization_id, user.organizations]);
  return html`<header class="topbar"><div class="topbar-in">
    <button class="btn ghost icon side-toggle" aria-label="Open navigation" aria-expanded=${side.open} aria-controls="app-side" onClick=${() => side.setOpen(!side.open)}><${Icon} name="menu" size=${18} /></button>
    <${Link} to="/sites" class="brand-mark" aria-label="Tidemark Analytics, all sites"><${Logo} size=${24} /><//>
    <nav class=${'crumbs' + (domain ? ' on-site' : '')} aria-label="Breadcrumb">
      <span class="crumb-sep" aria-hidden="true">/</span>
      <${OrgSwitcher} user=${user} /><span class="crumb-sep" aria-hidden="true">/</span>
      ${domain ? html`<${SiteSwitcher} list=${sites.list} current=${current} domain=${domain} recents=${recents} user=${user} scopeId=${scope.id} /><span class="crumb-sep s2" aria-hidden="true">/</span><span class="crumb-cur muted sec" aria-current="page">${sectionLabel(path, domain)}</span>`
        : html`<span class="crumb-cur" aria-current="page">${sectionLabel(path, domain)}</span>`}
    </nav>
    <div class="tb-right">
      <button class="find" onClick=${openPalette} aria-label=${'Find, ' + modKey() + ' K'} aria-haspopup="dialog"><${Icon} name="search" size=${14} /><span>Find</span><kbd>${modKey()} K</kbd></button>
      ${domain && html`<${LivePill} domain=${domain} />`}
      <${HelpMenu} user=${user} />
      <${AccountMenu} user=${user} />
    </div>
  </div></header>`;
}
