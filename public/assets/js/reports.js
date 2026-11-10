// The report building blocks: ranked lists, the cards of the overview and the funnel and journey views.
import { html, useState, setFilters, useEffect, useApi, addFilter, fmtShort, moneyShort, dur, flag, countryName, Icon, Link, scopeQuery } from './lib.js';
import { useDebounced, Delta, UpgradeLink } from './ui.js';
import { WorldMap } from './chart.js';

const DEVICE_ICON = { Desktop: 'monitor', Laptop: 'laptop', Tablet: 'tablet', Mobile: 'smartphone' };

/** The cell content for a row's name, depending on which dimension it belongs to. */
export function Label({ dim, name }) {
  if (dim === 'country') return html`<span class="flag" aria-hidden="true">${flag(name)}</span><span class="t">${countryName(name)}</span>`;
  if (dim === 'device') return html`<${Icon} name=${DEVICE_ICON[name] || 'monitor'} size=${14} class="muted" /><span class="t">${name}</span>`;
  return html`<span class="t" title=${name}>${name}</span>`;
}

export const pctCell = (v) => (v === null || v === undefined ? '–' : v + '%');
const COLUMNS = {
  page: [['visitors', 'Visitors', fmtShort], ['pageviews', 'Pageviews', fmtShort], ['bounce_rate', 'Bounce rate', pctCell]],
  entry_page: [['visitors', 'Unique entrances', fmtShort], ['visits', 'Total entrances', fmtShort], ['visit_duration', 'Visit duration', dur]],
  exit_page: [['visitors', 'Unique exits', fmtShort], ['visits', 'Total exits', fmtShort], ['exit_rate', 'Exit rate', pctCell]],
  _default: [['visitors', 'Visitors', fmtShort], ['bounce_rate', 'Bounce rate', pctCell], ['visit_duration', 'Visit duration', dur]],
};
/** Uniques, Total and CR for a goal, with Revenue and Average between them when the goal reports revenue. */
export const goalColumns = (currency) => [['visitors', 'Uniques', fmtShort], ['events', 'Total', fmtShort], ...(currency ? [['revenue', 'Revenue', (v) => moneyShort(v, currency)], ['average_revenue', 'Average', (v) => moneyShort(v, currency)]] : []), ['conversion_rate', 'CR', pctCell]];
export const columnsFor = (dim, goalMode, currency) => (goalMode ? goalColumns(currency) : COLUMNS[dim] || COLUMNS._default);

const pickRow = (dim, row) => addFilter(dim, row.name);

/** How a row changed against the comparison period. `prev` = { map: Map(name -> visitors), complete }; complete means the map holds every row. */
export function rowChange(prev, name, value) {
  if (!prev) return null;
  const was = prev.map.get(name);
  if (was === undefined) return prev.complete && value > 0 ? { isNew: true } : null;
  if (!was) return value > 0 ? { isNew: true } : null;
  return { change: ((value - was) / was) * 100 };
}
export const prevOf = (res) => (res && res.data ? { map: new Map(res.data.results.map((r) => [r.name, r.visitors])), complete: !res.data.has_more } : null);

/** A ranked list with proportional bars and, when a comparison is available, the change of each row. */
export function RankedList({ rows, dim, goalMode, currency, loading, empty = 'No data yet', head, onPick = pickRow, limit, error, onRetry, filtered, linkOut, prev, rowsHint = 6 }) {
  if (error && !rows) return html`<div class="panel-empty"><b>Couldn't load this report</b><p class="muted">${error.message}</p>${onRetry && html`<button class="btn sm" onClick=${onRetry}><${Icon} name="refresh-cw" size=${13} /> Try again</button>`}</div>`;
  if (!rows) return html`<div class="stack sm" aria-busy="true" aria-label="Loading">${Array.from({ length: rowsHint }, (_, i) => html`<div class="skeleton" style=${`height:28px;width:${100 - i * 6}%`}></div>`)}</div>`;
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return html`<div class="panel-empty"><span class="muted">${filtered ? 'Nothing matches the current filters' : empty}</span>${filtered && html`<button class="btn sm" onClick=${() => setFilters([])}>Clear filters</button>`}</div>`;
  const max = Math.max(1, ...shown.map((r) => r.visitors));
  const showDelta = !!prev && !goalMode;
  return html`<div class=${'mlist ' + (loading ? 'stale' : '')}>
    <div class="mhead"><span class="l">${head}</span><span class="r">${goalMode ? html`<span class="cr w">Conversions</span>${currency && html`<span class="cr w">Revenue</span>`}<span class="cr2">CR</span>` : html`${'Visitors'}${showDelta && html`<span class="rd">Change</span>`}`}</span></div>
    ${shown.map((r) => { const c = showDelta ? rowChange(prev, r.name, r.visitors) : null; return html`<button class="mrow" onClick=${() => onPick(dim, r)} title=${`Filter by ${r.name}`}>
      <span class="bar" style=${`width:${(r.visitors / max) * 100}%`}></span>
      <span class="l"><${Label} dim=${dim} name=${r.name} />${linkOut && /^https?:\/\//i.test(r.name) && html`<span class="ext" role="link" tabindex="0" aria-label="Open in a new tab" title="Open in a new tab" onClick=${(e) => { e.stopPropagation(); window.open(r.name, '_blank', 'noopener,noreferrer'); }} onKeyDown=${(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(r.name, '_blank', 'noopener,noreferrer'); } }}><${Icon} name="external-link" size=${12} /></span>`}</span>
      <span class="r">${goalMode ? html`<span class="cr w">${fmtShort(r.visitors)}</span>${currency && html`<span class="cr w">${r.revenue === undefined ? '–' : moneyShort(r.revenue, currency)}</span>`}<small class="cr2">${r.conversion_rate}%</small>` : html`${fmtShort(r.visitors)}${showDelta && html`<span class="rd">${c ? html`<${Delta} change=${c.change} isNew=${c.isNew} compact />` : ''}</span>`}`}</span></button>`; })}
  </div>`;
}

const storedTab = (id, fallback) => { try { return localStorage.getItem('tidemark.tab.' + id) || fallback; } catch (e) { return fallback; } };
const saveTab = (id, v) => { try { localStorage.setItem('tidemark.tab.' + id, v); } catch (e) { /* ignore */ } };

/** The path of a report page for this view (kept in the share link when the dashboard is shared). */
export const reportHref = (site, shared, report, extra) => (shared ? `/share/${site.domain}/${report}` : `/${site.domain}/${report}`) + scopeQuery(extra);

/** A card with tabs; each tab renders its own body. `route` adds a "View all" link to the full report. */
function Panel({ id, title, tabs, children, prefer, site, shared, route, viewAllTab }) {
  const [tab, setTab] = useState(() => (tabs.find((t) => t.key === prefer) || tabs.find((t) => t.key === storedTab(id)) || tabs[0]).key);
  useEffect(() => { if (prefer) setTab(prefer); }, [prefer]);
  // the Insights card asks a report to show a tab ("source" for a new referrer)
  useEffect(() => {
    const h = (e) => { const d = e.detail || {}; if (d.card === id && tabs.some((t) => t.key === d.tab)) setTab(d.tab); };
    window.addEventListener('tdm:tab', h);
    return () => window.removeEventListener('tdm:tab', h);
  });
  const active = tabs.find((t) => t.key === tab) || tabs[0];
  return html`<section class="card panel" id=${'card-' + id} aria-label=${title}>
    <div class="card-h"><h3>${title}</h3><div class="tabs" role="tablist" aria-label=${title + ' views'}>${tabs.map((t) => html`<button role="tab" type="button" aria-selected=${t.key === active.key} class=${t.key === active.key ? 'on' : ''} onClick=${() => { setTab(t.key); saveTab(id, t.key); }}>${t.label}</button>`)}</div></div>
    <div class="card-b panel-b">${children(active)}</div>
    ${route && html`<div class="card-f panel-f"><${Link} to=${reportHref(site, shared, route, { tab: (viewAllTab ? viewAllTab(active) : active.key) })} class="viewall">View all<${Icon} name="arrow-right" size=${14} /><//></div>`}
  </section>`;
}

/** A breakdown list for one dimension, with the change against the comparison period when `scope.cmp` is set. */
function DimBody({ dim, label, site, scope, poll, limit = 7 }) {
  const goalMode = !!scope.goal;
  const res = useApi(`/sites/${site.domain}/stats/breakdown/${dim}`, { ...scope.params, limit }, [], { poll });
  const before = useApi(`/sites/${site.domain}/stats/breakdown/${dim}`, { ...scope.cmp, limit: 100 }, [], { enabled: !!scope.cmp && !goalMode });
  const rows = res.data && res.data.results;
  return html`<${RankedList} rows=${rows} dim=${dim} goalMode=${goalMode} currency=${res.data && res.data.currency} loading=${res.loading} head=${label} error=${res.error} onRetry=${res.reload} filtered=${scope.filters.length > 0} rowsHint=${limit} prev=${before.data ? prevOf(before) : null} />
    ${res.data && res.data.hidden_below && html`<p class="muted small" style="margin:8px 4px 0">Rows with fewer than ${res.data.hidden_below} visitors are hidden.</p>`}`;
}

export const UTM = [['utm_medium', 'UTM medium'], ['utm_source', 'UTM source'], ['utm_campaign', 'UTM campaign'], ['utm_content', 'UTM content'], ['utm_term', 'UTM term']];
const dimTitle = { channel: 'Channel', source: 'Source', utm_medium: 'Medium', utm_campaign: 'Campaign', page: 'Page', entry_page: 'Entry page', exit_page: 'Exit page', country: 'Country', region: 'Region', city: 'City', browser: 'Browser', os: 'Operating system', device: 'Device' };

const dimCard = (id, title, route, tabs, extra = {}) => function Card({ site, scope, poll, shared }) {
  return html`<${Panel} id=${id} title=${title} site=${site} shared=${shared} route=${route} tabs=${tabs}>
    ${(t) => (t.render ? t.render({ site, scope, poll }) : html`<${DimBody} key=${t.key} dim=${t.key} label=${dimTitle[t.key] || t.label} site=${site} scope=${scope} poll=${poll} />`)}<//>`;
};

export const PagesCard = dimCard('pages', 'Pages', 'pages', [{ key: 'page', label: 'Top pages' }, { key: 'entry_page', label: 'Entry' }, { key: 'exit_page', label: 'Exit' }]);
export const SourcesCard = dimCard('sources', 'Sources', 'sources', [{ key: 'channel', label: 'Channels' }, { key: 'source', label: 'Sources' }, { key: 'utm_medium', label: 'Mediums' }, { key: 'utm_campaign', label: 'Campaigns' }]);
export const DevicesCard = dimCard('devices', 'Devices', 'devices', [{ key: 'browser', label: 'Browsers' }, { key: 'os', label: 'Systems' }, { key: 'device', label: 'Devices' }]);

function MapBody({ site, scope, poll }) {
  const res = useApi(`/sites/${site.domain}/stats/breakdown/country`, { ...scope.params, limit: 250 }, [], { poll });
  const before = useApi(`/sites/${site.domain}/stats/breakdown/country`, { ...scope.cmp, limit: 250 }, [], { enabled: !!scope.cmp && !scope.goal });
  const rows = res.data && res.data.results;
  return html`${rows ? html`<${WorldMap} rows=${rows} valueLabel=${scope.goal ? 'Conversions' : 'Visitors'} onPick=${(c) => addFilter('country', c)} />` : html`<div class="skeleton" style="height:230px"></div>`}
    ${rows && rows.length > 0 && html`<div style="margin-top:10px"><${RankedList} rows=${rows} dim="country" goalMode=${!!scope.goal} head="Country" limit=${4} filtered=${scope.filters.length > 0} prev=${before.data ? prevOf(before) : null} /></div>`}
    ${rows && !rows.length && html`<div class="panel-empty"><span class="muted">${scope.filters.length ? 'Nothing matches the current filters' : 'No location data yet'}</span>${scope.filters.length > 0 && html`<button class="btn sm" onClick=${() => setFilters([])}>Clear filters</button>`}</div>`}
    ${res.error && !rows && html`<div class="panel-empty"><b>Couldn't load the map</b><button class="btn sm" onClick=${res.reload}>Try again</button></div>`}`;
}
export const LocationsCard = dimCard('locations', 'Locations', 'locations', [{ key: 'country', label: 'Countries' }, { key: 'map', label: 'Map', render: (p) => html`<${MapBody} ...${p} />` }, { key: 'region', label: 'Regions' }, { key: 'city', label: 'Cities' }]);

export function GoalsBody({ site, scope, poll }) {
  const res = useApi(`/sites/${site.domain}/stats/goals`, scope.params, [], { poll });
  const rows = res.data && res.data.results;
  if (!rows) return html`<${RankedList} rows=${null} />`;
  if (!rows.length) return html`<div class="panel-empty"><b>Measure what matters</b><p class="muted">Goals count the conversions that matter — signups, purchases, downloads.</p>${site.can_manage && html`<${Link} to=${`/${site.domain}/settings/goals`} class="btn sm">Set up goals<//>`}</div>`;
  const shownRows = rows.slice(0, 8);
  const max = Math.max(1, ...shownRows.map((r) => r.visitors));
  const revenue = rows.some((r) => r.currency);
  const mixed = new Set(rows.filter((r) => r.currency).map((r) => r.currency)).size > 1;
  return html`<div class=${'mlist ' + (res.loading ? 'stale' : '')}>
    <div class="mhead"><span class="l">Goal</span><span class="r"><span class="cr">Uniques</span><span class="cr">Total</span>${revenue && html`<span class="cr w">Revenue</span><span class="cr w">Average</span>`}<span class="cr2">CR</span></span></div>
    ${shownRows.map((r) => html`<button class="mrow" onClick=${() => addFilter('goal', r.name)} title="Filter by this goal"><span class="bar" style=${`width:${(r.visitors / max) * 100}%`}></span><span class="l"><span class="t">${r.name}</span></span>
      <span class="r"><span class="cr">${fmtShort(r.visitors)}</span><span class="cr">${fmtShort(r.events)}</span>${revenue && html`<span class="cr w">${r.currency ? moneyShort(r.revenue, r.currency) : '–'}</span><span class="cr w">${r.currency ? moneyShort(r.average_revenue, r.currency) : '–'}</span>`}<small class="cr2">${r.conversion_rate}%</small></span></button>`)}
    ${mixed && html`<p class="muted" style="font-size:12px;margin:6px 8px 0">Revenue is shown in each goal's own currency.</p>`}</div>`;
}

export function PropsBody({ site, scope, poll, fixed, linkOut }) {
  const keys = useApi(`/sites/${site.domain}/stats/props`, scope.params, [], { poll, enabled: !fixed });
  const list = fixed ? [{ name: fixed }] : (keys.data && keys.data.results) || [];
  const [key, setKey] = useState(null);
  const active = list.find((k) => k.name === key) ? key : list[0] && list[0].name;
  const res = useApi(`/sites/${site.domain}/stats/props/${encodeURIComponent(active || '')}`, { ...scope.params, limit: 8 }, [], { enabled: !!active, poll });
  if (!fixed && !keys.data) return html`<${RankedList} rows=${null} />`;
  if (!list.length) return html`<div class="panel-empty"><b>Custom properties</b><p class="muted">Send extra details with your events, like plan or button label, and break results down by them.</p></div>`;
  const rows = res.data && res.data.results;
  const dim = 'prop:' + active;
  return html`${!fixed && html`<div class="subselect"><label class="sr-only" for="prop-key">Property</label><select id="prop-key" value=${active} onChange=${(e) => setKey(e.target.value)}>${list.map((k) => html`<option value=${k.name}>${k.name}</option>`)}</select></div>`}
    <${RankedList} rows=${rows} dim=${dim} goalMode=${true} head=${active} loading=${res.loading} linkOut=${linkOut} error=${res.error} onRetry=${res.reload} empty="No data for this goal yet" />
`;
}


/** One funnel as columns, one per step: how many visitors reached it, how many of those came from the step before, and how many dropped off. */
export function FunnelChart({ funnel, loading }) {
  const steps = funnel.steps;
  const first = steps.length ? steps[0].visitors : 0;
  return html`<div class=${'funnel ' + (loading ? 'stale' : '')}>
    <div class="funnel-head"><b>${funnel.name}</b><span class="muted">${steps.length}-step funnel<span class="sep">|</span><span title="All steps are required, in this order. Other activity is allowed between steps.">Sequential</span><span class="sep">|</span>Conversion rate: <b class="cr-all">${funnel.conversion_rate}%</b></span></div>
    <div class="funnel-steps" style=${`--steps:${steps.length}`}>${steps.map((st, i) => html`<div class="fstep">
      <div class="fl"><span class="t" title=${st.name}>${st.name}</span><b>${st.conversion_rate}%</b><span class="muted">${fmtShort(st.visitors)} ${st.visitors === 1 ? 'visitor' : 'visitors'}</span></div>
      <div class="fbar"><div class="fill" style=${`height:${first ? Math.max(st.visitors ? 2 : 0, (st.visitors / first) * 100) : 0}%`}>
        <span class="fbadge">${i === steps.length - 1 ? html`<${Icon} name="check" size=${12} />` : html`<${Icon} name="arrow-right" size=${12} />`} ${st.conversion_rate_step}%${i > 0 && html` <${Icon} name="arrow-down" size=${12} /> ${st.dropoff_percentage}%`}</span></div></div></div>`)}</div></div>`;
}

export function FunnelsBody({ site, scope, poll }) {
  const list = useApi(`/sites/${site.domain}/stats/funnels`, undefined, [], {});
  const [pick, setPick] = useState(null);
  const funnels = (list.data && list.data.results) || [];
  const active = funnels.find((f) => f.id === pick) || funnels[0];
  const res = useApi(active ? `/sites/${site.domain}/stats/funnels/${active.id}` : null, scope.params, [active && active.id], { enabled: !!active, poll });
  if (list.error) return html`<div class="panel-empty"><b>Couldn't load funnels</b><p class="muted">${list.error.message}</p><button class="btn sm" onClick=${list.reload}>Try again</button></div>`;
  if (!list.data) return html`<${RankedList} rows=${null} />`;
  if (list.data.allowed === false) return html`<div class="panel-empty"><b>Funnels come with Pro</b><p class="muted">See where visitors drop off between the steps of a signup or purchase.</p>${site.can_manage && html`<${UpgradeLink} class="btn sm">Upgrade<//>`}</div>`;
  if (!funnels.length) return html`<div class="panel-empty"><b>See where visitors drop off</b><p class="muted">A funnel follows visitors through a series of goals, like pricing page, signup and purchase.</p>${site.can_manage && html`<${Link} to=${`/${site.domain}/settings/funnels`} class="btn sm">Set up a funnel<//>`}</div>`;
  return html`${funnels.length > 1 && html`<div class="subselect"><label class="sr-only" for="funnel-pick">Funnel</label><select id="funnel-pick" value=${active.id} onChange=${(e) => setPick(e.target.value)}>${funnels.map((f) => html`<option value=${f.id} selected=${f.id === active.id}>${f.name}</option>`)}</select></div>`}
    ${res.data ? html`<${FunnelChart} funnel=${res.data} loading=${res.loading} />` : res.error ? html`<div class="panel-empty"><b>Couldn't load this funnel</b><p class="muted">${res.error.message}</p><button class="btn sm" onClick=${res.reload}>Try again</button></div>` : html`<div class="skeleton" style="height:240px"></div>`}`;
}

/** One column of the journeys explorer: what visitors did at this step, given the steps chosen before it. */
export function JourneyColumn({ i, site, scope, steps, dir, picked, onPick, onToggle }) {
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const res = useApi(`/sites/${site.domain}/stats/journeys`, { ...scope.params, steps: JSON.stringify(steps.map((x) => [x.type, x.value])), direction: dir, search: search || undefined, limit: 20 }, [], {});
  const items = res.data && res.data.items;
  const max = Math.max(1, ...(items || []).map((x) => x.visitors));
  const title = i === 0 ? (dir === 'start' ? 'Starting point' : 'Ending point') : `${i} step${i > 1 ? 's' : ''} ${dir === 'start' ? 'after' : 'before'}`;
  return html`<div class="jcol"><div class="jcol-h">${i === 0 ? html`<button class="jtoggle" onClick=${onToggle} title="Switch between where visits start and where they end">${title} <${Icon} name="arrow-up-down" size=${12} /></button>` : html`<b>${title}</b>`}
      <input class="jsearch" placeholder="Search" aria-label=${'Search ' + title} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <div class=${'jlist ' + (res.loading ? 'stale' : '')}>${res.error ? html`<div class="panel-empty"><span class="muted">${res.error.message}</span></div>` : !items ? html`<div class="skeleton" style="height:120px"></div>` : !items.length ? html`<div class="panel-empty"><span class="muted">${i === 0 ? 'No visits in this period' : 'Nothing here'}</span></div>`
      : items.map((x) => html`<button class=${'mrow ' + (picked && picked.type === x.type && picked.value === x.value ? 'sel' : '')} onClick=${() => (x.type === 'none' ? null : onPick(x))} disabled=${x.type === 'none'}><span class="bar" style=${`width:${(x.visitors / max) * 100}%`}></span>
        <span class="l">${x.type === 'group' && html`<${Icon} name="folder" size=${13} class="muted" />`}<span class="t" title=${x.value}>${x.type === 'none' ? 'No further action' : x.type === 'group' ? x.value + '/*' : x.value}</span></span><span class="r">${fmtShort(x.visitors)}</span></button>`)}</div></div>`;
}

export function ExploreBody({ site, scope }) {
  const [dir, setDir] = useState('start');
  const [steps, setSteps] = useState([]);
  const probe = useApi(`/sites/${site.domain}/stats/journeys`, { ...scope.params, steps: '[]', limit: 1 }, [], {});
  if (probe.data && probe.data.allowed === false) return html`<div class="panel-empty"><b>Journeys come with Pro</b><p class="muted">See the routes visitors take through your site, step by step.</p>${site.can_manage && html`<${UpgradeLink} class="btn sm">Upgrade<//>`}</div>`;
  const shown = Math.max(3, Math.min(steps.length + 1, 5));
  const pick = (i, x) => setSteps([...steps.slice(0, i), x]);
  return html`<div class="explore"><div class="explore-h"><b>Explore user journeys</b>${steps.length > 0 && html`<button class="btn sm ghost" onClick=${() => setSteps([])} title="Start again"><${Icon} name="refresh-cw" size=${13} /> Reset</button>`}</div>
    <div class="jcols">${Array.from({ length: shown }, (_, i) => (i <= steps.length
      ? html`<${JourneyColumn} key=${dir + i + JSON.stringify(steps.slice(0, i))} i=${i} site=${site} scope=${scope} steps=${steps.slice(0, i)} dir=${dir} picked=${steps[i]} onPick=${(x) => pick(i, x)} onToggle=${() => { setDir(dir === 'start' ? 'end' : 'start'); setSteps([]); }} />`
      : html`<div class="jcol idle"><div class="jcol-h"><b>${i} step${i > 1 ? 's' : ''} ${dir === 'start' ? 'after' : 'before'}</b></div><div class="panel-empty"><${Icon} name="mouse-pointer-click" size=${16} class="muted" /><span class="muted">${i === 1 ? 'Select a starting point to continue' : 'Select an event to continue'}</span></div></div>`))}</div></div>`;
}

/** Goals that carry one obvious detail: filtering by them drills down to a list of it (like clicking "Outbound Link: Click"). */
export const GOAL_DETAIL = {
  'Outbound Link: Click': { prop: 'url', label: 'Outbound links', linkOut: true },
  'File Download': { prop: 'url', label: 'File downloads', linkOut: true },
  'Form: Submission': { prop: 'path', label: 'Form submissions' },
};

export function GoalsCard({ site, scope, poll, shared }) {
  const detail = scope.goal ? GOAL_DETAIL[scope.goal] : null;
  const tabs = [...(detail ? [{ key: 'detail', label: detail.label }] : []), { key: 'goals', label: 'Goals' }, { key: 'props', label: 'Properties' }];
  return html`<${Panel} id="goals" title="Goals and events" site=${site} shared=${shared} route="events" prefer=${detail ? 'detail' : undefined} tabs=${tabs} viewAllTab=${(t) => (t.key === 'props' ? 'props' : 'goals')}>
    ${(t) => (t.key === 'detail' ? html`<${PropsBody} key=${detail.prop} site=${site} scope=${scope} poll=${poll} fixed=${detail.prop} linkOut=${detail.linkOut} />` : t.key === 'goals' ? html`<${GoalsBody} site=${site} scope=${scope} poll=${poll} />` : html`<${PropsBody} site=${site} scope=${scope} poll=${poll} />`)}<//>`;
}

/** Utm values beyond the four tabs of the Sources card live on the full report; this small card is the campaign view for the overview. */
export const CampaignsCard = dimCard('campaigns', 'Campaigns', 'sources', [{ key: 'utm_campaign', label: 'Campaigns' }, { key: 'utm_source', label: 'UTM sources' }, { key: 'utm_content', label: 'Content' }, { key: 'utm_term', label: 'Terms' }]);

// ---- compatibility: the panels extensions and older code import by name -------------------------------------------------------
export const Sources = SourcesCard, Pages = PagesCard, Locations = LocationsCard, Devices = DevicesCard;
/** The old "Behaviors" panel (goals, properties, funnels, journeys in tabs). The dashboard now has their own pages; kept for extensions. */
export function Behaviors({ site, scope, poll }) {
  const f = site.features || {};
  const tabs = [{ key: 'goals', label: 'Goals' }, { key: 'props', label: 'Properties' }, ...(f.funnels || site.can_manage ? [{ key: 'funnels', label: 'Funnels' }] : []), ...(f.journeys || site.can_manage ? [{ key: 'explore', label: 'Explore' }] : [])];
  return html`<${Panel} id="behaviors" title="Behaviors" tabs=${tabs}>
    ${(t) => (t.key === 'goals' ? html`<${GoalsBody} site=${site} scope=${scope} poll=${poll} />` : t.key === 'funnels' ? html`<${FunnelsBody} site=${site} scope=${scope} poll=${poll} />` : t.key === 'explore' ? html`<${ExploreBody} site=${site} scope=${scope} />` : html`<${PropsBody} site=${site} scope=${scope} poll=${poll} />`)}<//>`;
}
