import { html, useState, useEffect, useMemo, useApi, api, navigate, Link, Icon, toast, fmtShort, useDocTitle, UserCtx, useContext, BASE, useLocation, setQuery } from './lib.js';
import { Loading, Empty, Field, ErrorBox, Sparkline, Toggle, Pop, FavTile, Badge, SettingCard, Segmented, Breadcrumb, Notice, UpgradeLink } from './ui.js';
import { Snippet } from './dashboard.js';
import { useScope, organizationsOn } from './org.js';

const VIEW_KEY = 'tidemark.sitesView';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch (e) { return 'grid'; } };

/** Receiving data = at least one visitor in the last 24 hours. */
const isLive = (s) => s.visitors > 0 || (s.series || []).some((n) => n > 0);
const Status = ({ s }) => (isLive(s) ? html`<span class="status"><span class="dot static" aria-hidden="true"></span>Receiving data</span>` : html`<span class="status"><span class="dot off" aria-hidden="true"></span>No data in 24 hours</span>`);
const Change = ({ s }) => { const up = s.change > 0, down = s.change < 0; return html`<b class=${up ? 'up' : down ? 'down' : ''}>${s.change === 0 ? '–' : html`${up ? '+' : ''}${s.change}%`}</b>`; };
const Tags = ({ s }) => html`${s.rollup && html`<${Badge} tone="brand">Rollup · ${s.members} ${s.members === 1 ? 'site' : 'sites'}<//>`}${s.public && html`<${Badge} tone="outline">Public<//>`}`;

function SiteCard({ s }) {
  return html`<${Link} to=${'/' + s.domain} class=${'card site' + (s.visitors === 0 ? ' quiet' : '')} aria-label=${s.domain}>
    <div class="name"><${FavTile} name=${s.domain} rollup=${s.rollup} /><div class="grow" style="min-width:0"><div class="row" style="gap:8px"><span class="t">${s.domain}</span><${Tags} s=${s} /></div><${Status} s=${s} /></div></div>
    <div class="nums"><div><b>${fmtShort(s.visitors)}</b><span>Visitors, last 24 hours</span></div>
      <div><${Change} s=${s} /><span>vs previous</span></div></div>
    <${Sparkline} data=${s.series} />
  <//>`;
}

function SitesTable({ list }) {
  return html`<div class="card"><div class="card-flush"><table class="t stack-sm sites-list"><caption class="sr-only">Your sites</caption><thead><tr><th scope="col">Site</th><th scope="col">Status</th><th scope="col" class="right">Visitors, 24h</th><th scope="col" class="right">Change</th><th scope="col"><span class="sr-only">Trend</span></th></tr></thead>
    <tbody>${list.map((s) => html`<tr class="click" onClick=${() => navigate('/' + s.domain)}>
      <td data-label="Site"><div class="row-site"><${FavTile} name=${s.domain} rollup=${s.rollup} size="sm" /><${Link} to=${'/' + s.domain}><b>${s.domain}</b><//><${Tags} s=${s} /></div></td>
      <td data-label="Status" class="muted"><${Status} s=${s} /></td>
      <td data-label="Visitors" class="right num">${fmtShort(s.visitors)}</td>
      <td data-label="Change" class=${'right num ' + (s.change > 0 ? 'up' : s.change < 0 ? 'down' : '')} style=${s.change > 0 ? 'color:var(--success)' : s.change < 0 ? 'color:var(--destructive)' : ''}>${s.change === 0 ? '–' : (s.change > 0 ? '+' : '') + s.change + '%'}</td>
      <td class="right"><${Sparkline} data=${s.series} height=${28} /></td></tr>`)}</tbody></table></div></div>`;
}

const SitesSkeleton = () => html`<div class="sites" aria-busy="true" aria-label="Loading sites">${[0, 1, 2].map(() => html`<div class="card site"><div class="skeleton" style="height:24px;width:60%"></div><div class="skeleton" style="height:40px;width:80%;margin-top:18px"></div><div class="skeleton" style="height:40px;margin:14px -20px 0;border-radius:0"></div></div>`)}</div>`;

export function SitesPage() {
  useDocTitle('Sites');
  const { user } = useContext(UserCtx) || {};
  const scope = useScope(user);
  const res = useApi('/sites', scope.id && !scope.flat ? { organization: scope.id } : null, [scope.id, scope.flat]);
  const { query } = useLocation();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('visitors');
  const [view, setViewState] = useState(readView);
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* private mode */ } };
  const kind = query.kind === 'rollups' ? 'rollups' : 'all';
  const all = (res.data && res.data.data) || [];
  const list = useMemo(() => {
    const f = all.filter((s) => s.domain.includes(q.toLowerCase()) && (kind === 'all' || s.rollup));
    return f.sort((a, b) => (a.rollup !== b.rollup ? (a.rollup ? -1 : 1) : sort === 'name' ? a.domain.localeCompare(b.domain) : b.visitors - a.visitors || a.domain.localeCompare(b.domain)));
  }, [res.data, q, sort, kind]);
  const total = all.length;
  const real = all.filter((s) => !s.rollup);
  const realSites = all.filter((s) => !s.rollup && s.role).length;
  const rollups = list.filter((s) => s.rollup), sites = list.filter((s) => !s.rollup);
  const groups = rollups.length && sites.length ? [['Rollups', rollups], ['Sites', sites]] : [['', list]];
  const myOrg = scope.org && (user && user.organizations || []).find((o) => o.id === scope.org.id);
  const canRollup = !scope.shared && !!myOrg && realSites >= 2 && myOrg.can_rollup !== false;
  return html`<main class="main"><header class="page-head"><div class="grow"><h1>${kind === 'rollups' ? 'Rollups' : 'Sites'}</h1>${res.data && total > 0 && html`<div class="sub"><b>${fmtShort(real.reduce((n, s) => n + s.visitors, 0))}</b> visitors across ${real.length} ${real.length === 1 ? 'site' : 'sites'} in the last 24 hours</div>`}</div>
    <div class="row wrap">${total > 3 && html`<div class="searchbox"><${Icon} name="search" size=${14} /><input placeholder="Search sites" aria-label="Search sites" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>`}
      ${total > 1 && html`<select aria-label="Sort" value=${sort} onChange=${(e) => setSort(e.target.value)} style="width:auto"><option value="visitors" selected=${sort === 'visitors'}>Most visitors</option><option value="name" selected=${sort === 'name'}>Name</option></select>`}
      ${total > 0 && html`<${Segmented} label="Layout" value=${view} onChange=${setView} items=${[['grid', 'Grid view', 'layout-grid'], ['list', 'List view', 'list']]} />`}
      <div class="split"><${Link} to="/sites/new" class="btn primary"><${Icon} name="plus" size=${14} /> New site<//>
        <${Pop} align="right" ariaLabel="More ways to add" btnClass="btn primary" label=${html`<${Icon} name="chevron-down" size=${14} />`}>${(close) => html`<div style="min-width:240px">
          <${Link} to="/sites/new" class="item" onClick=${close}><span>Site</span><${Icon} name="globe" size=${14} /><//>
          ${canRollup ? html`<${Link} to="/sites/rollup" class="item" onClick=${close}><span>Rollup</span><${Icon} name="layers" size=${14} /><//>` : html`<span class="item" aria-disabled="true" style="opacity:.55;cursor:not-allowed"><span>Rollup</span><span class="muted small">${user && user.can_rollup === false ? 'Not in plan' : 'Needs 2 sites'}</span></span>`}
          <${Link} to="/sites/new?import=plausible" class="item" onClick=${close}><span>Import from Plausible</span><${Icon} name="upload" size=${14} /><//></div>`}<//></div></div></header>
    ${res.data && res.data.other_sites && res.data.other_sites.count > 0 && html`<div class="notice other-sites"><${Icon} name="info" size=${16} /><div>These are the sites you belong to. ${res.data.other_sites.count.toLocaleString()} other ${res.data.other_sites.count === 1 ? 'site' : 'sites'} on this installation ${res.data.other_sites.count === 1 ? 'is' : 'are'} listed separately. <a href=${BASE + res.data.other_sites.path}>View them</a></div></div>`}
    ${res.error && !res.data ? html`<${ErrorBox} error=${res.error} />` : res.loading && !res.data ? html`<${SitesSkeleton} />` : total === 0 ? html`<${Empty} title="Add your first site" icon="globe">Tidemark counts visitors without cookies or personal data. Add a site to get a tracking snippet.<${Link} to="/sites/new" class="btn primary" style="margin-top:10px">Add a site<//><//>`
      : list.length ? groups.map(([label, items]) => html`<section class="sites-group">${label && html`<h2>${label}<span class="badge">${items.length}</span></h2>`}${view === 'list' ? html`<${SitesTable} list=${items} />` : html`<div class="sites">${items.map((s) => html`<${SiteCard} s=${s} />`)}</div>`}</section>`)
        : html`<${Empty} title="No matching sites" icon="search">${q ? html`Nothing matches “${q}”.` : 'You have no rollups yet.'}<//>`}
  </main>`;
}

const zones = () => { try { return ['UTC', ...Intl.supportedValuesOf('timeZone')]; } catch (e) { return ['UTC']; } };

export function NewSite() {
  useDocTitle('Add a site');
  const { query } = useLocation();
  const importing = query.import === 'plausible';
  const { user } = useContext(UserCtx);
  const scope = useScope(user);
  const target = scope.shared ? ((scope.orgs.find((o) => o.personal) || {}).id || '') : scope.id;
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api('/sites', { method: 'POST', body: { domain, timezone, ...(target ? { organization: target } : {}) } }); navigate(importing ? `/${r.data.domain}/settings/data` : `/${r.data.domain}/installation`); }
    catch (x) { setErr((x.errors && x.errors.domain && x.errors.domain[0]) || x.message); setBusy(false); }
  };
  return html`<main class="main narrow"><header class="page-head"><div class="grow"><${Breadcrumb} items=${[{ label: 'Sites', to: '/sites' }, { label: 'New site' }]} /><h1 style="margin-top:8px">${importing ? 'Add a site and import from Plausible' : 'Add a site'}</h1><div class="sub">Tell Tidemark which domain you want to measure.${importing ? ' You will pick the Plausible export on the next page.' : ''}</div></div></header>
    <form onSubmit=${submit}><${SettingCard} title="Site details" help="You can change the timezone later in the site's settings."
      footer=${html`<span class="help">No cookies, no personal data: Tidemark counts visits only.</span><div class="row"><${Link} to="/sites" class="btn ghost">Cancel<//><button class="btn primary" disabled=${busy || !domain}>${busy ? 'Adding…' : 'Add site'}</button></div>`}>
      ${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      ${scope.orgs.length > 1 && html`<p class="muted small" style="margin:0">This site will belong to <b>${(scope.orgs.find((o) => o.id === target) || {}).name === 'Personal' || (scope.orgs.find((o) => o.id === target) || {}).personal ? 'your Personal organization' : (scope.orgs.find((o) => o.id === target) || {}).name}</b>. Switch organization in the top bar to add it somewhere else.</p>`}
      <${Field} label="Domain" help="Just the domain: no https:// and no path."><input required autofocus placeholder="example.com" value=${domain} onInput=${(e) => setDomain(e.target.value)} autocapitalize="off" spellcheck="false" /><//>
      <${Field} label="Reporting timezone" help="Days start and end at midnight in this timezone."><select value=${timezone} onChange=${(e) => setTimezone(e.target.value)}>${zones().map((z) => html`<option value=${z} selected=${z === timezone}>${z}</option>`)}</select><//>
    <//></form></main>`;
}

export function Installation({ domain }) {
  useDocTitle('Install ' + domain);
  const res = useApi(`/sites/${domain}`, null, [domain], { poll: 4000 });
  const s = res.data && res.data.data;
  useEffect(() => { if (s && s.has_data) { toast('First pageview received'); navigate('/' + domain, { replace: true }); } }, [s && s.has_data]);
  if (res.error) return html`<main class="main"><${ErrorBox} error=${res.error} /></main>`;
  if (!s) return html`<main class="main narrow"><${Loading} /></main>`;
  const set = async (k, v) => { await api(`/sites/${domain}`, { method: 'PATCH', body: { [k]: v } }); res.reload(); };
  return html`<main class="main narrow"><header class="page-head"><div class="grow"><${Breadcrumb} items=${[{ label: 'Sites', to: '/sites' }, { label: domain }, { label: 'Installation' }]} /><h1 style="margin-top:8px">Install the snippet</h1><div class="sub">Add the Tidemark script to every page on ${domain}.</div></div></header>
    <div class="stack">
      <${SettingCard} title="1. Add the tracking snippet" help="Choose what your site runs on to see what to add. The script is about 1 KB and sets no cookies."
        footer=${html`<span class="row" style="gap:8px"><span class="dot" aria-hidden="true"></span><span>Waiting for your first pageview. This page continues automatically once data arrives.</span></span><${Link} to=${'/' + domain} class="btn sm">Skip to the dashboard<//>`}>
        <${Snippet} site=${s} />
        <p class="muted small">Using a framework or a single-page app? Pageviews are tracked automatically on route changes. You can also send custom events with <code>window.plausible('Signup')</code>.</p>
      <//>
      <${SettingCard} title="2. Also track (optional)" help="Each one adds a small extension to the script and a matching goal.">
        <${Toggle} label="Outbound link clicks" help="Counts clicks on links that leave your site." checked=${s.track_outbound} onChange=${(v) => set('track_outbound', v)} />
        <${Toggle} label="File downloads" help="Counts clicks on links to PDFs, archives and similar." checked=${s.track_downloads} onChange=${(v) => set('track_downloads', v)} />
        <${Toggle} label="Form submissions" help="Counts submitted forms." checked=${s.track_forms} onChange=${(v) => set('track_forms', v)} />
        <${Toggle} label="Scroll depth and time on page" help="Sends one extra event per page view as a visitor leaves it: how far they scrolled and how long they were active. It does not change bounce rate." checked=${s.track_engagement} onChange=${(v) => set('track_engagement', v)} />
      <//>
    </div></main>`;
}

/** Make a rollup: one dashboard that adds up several of your sites. */
export function NewRollup() {
  useDocTitle('Create a rollup');
  const { user } = useContext(UserCtx) || {};
  const scope = useScope(user);
  const orgId = scope.shared ? null : scope.org && scope.org.id;
  const org = orgId && (user && user.organizations || []).find((o) => o.id === orgId);
  const sites = useApi('/rollups/candidates' + (orgId ? '?organization=' + orgId : ''), null, [orgId]);
  const [name, setName] = useState('');
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = (sites.data && sites.data.data) || [];
  const allowed = !org || org.can_rollup !== false;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api('/rollups', { method: 'POST', body: { name, organization: orgId || undefined, all, sites: all ? undefined : chosen } }); navigate('/' + r.data.domain); }
    catch (x) { setErr((x.errors && Object.values(x.errors)[0][0]) || x.message); setBusy(false); }
  };
  return html`<main class="main narrow"><header class="page-head"><div class="grow"><${Breadcrumb} items=${[{ label: 'Sites', to: '/sites' }, { label: 'New rollup' }]} /><h1 style="margin-top:8px">Create a rollup</h1><div class="sub">One dashboard that adds up several sites of ${org && !org.personal ? org.name : 'your Personal organization'}. The sites keep their own dashboards and data.</div></div></header>
    <form onSubmit=${submit}><${SettingCard} title="Rollup" help="Imported data is left out, and a revenue goal adds up only amounts sent in its own currency. The rollup's timezone starts as the one most of its sites use."
      footer=${html`<span class="help">${all ? (organizationsOn() ? 'Includes every site in the organization, now and later.' : 'Includes every site you own, now and later.') : `${chosen.length} ${chosen.length === 1 ? 'site' : 'sites'} selected.`}</span><div class="row"><${Link} to="/sites" class="btn ghost">Cancel<//><button class="btn primary" disabled=${busy || !name || !allowed || (!all && !chosen.length)}>${busy ? 'Creating…' : 'Create rollup'}</button></div>`}>
      ${!allowed && html`<div class="notice"><${Icon} name="info" size=${16} /><div>Rollups aren’t included in your plan. <${UpgradeLink} to="/settings/billing">Change your plan<//> to turn them on.</div></div>`}
      ${err && html`<div class="alert" role="alert"><${Icon} name="circle-alert" size=${16} /><div>${err}</div></div>`}
      <${Field} label="Name" help="Letters, numbers and hyphens, like all-sites. It becomes the dashboard's address."><input required autofocus placeholder="all-sites" value=${name} onInput=${(e) => setName(e.target.value)} autocapitalize="off" spellcheck="false" maxlength="63" /><//>
      <fieldset class="fieldset"><legend class="lbl">Sites</legend>
        <div class="stack sm"><label class="row"><input type="radio" name="scope" checked=${all} onChange=${() => setAll(true)} /> <span><b>${organizationsOn() ? 'All the sites in this organization' : 'All your sites'}</b>, including ones added later</span></label>
          <label class="row"><input type="radio" name="scope" checked=${!all} onChange=${() => setAll(false)} /> <span>Only the sites I choose</span></label></div></fieldset>
      ${!all && html`<div class="stack sm" role="group" aria-label="Sites in this rollup">${list.map((s) => html`<label class="row"><input type="checkbox" checked=${chosen.includes(s.domain)} onChange=${(e) => setChosen(e.target.checked ? [...chosen, s.domain] : chosen.filter((d) => d !== s.domain))} /> <span>${s.domain}</span></label>`)}</div>`}
    <//></form></main>`;
}
