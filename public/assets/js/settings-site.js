// Site settings: tracking, conversions, sharing and access, data.
import { html, useState, useEffect, useRef, useApi, api, navigate, Link, Icon, toast, copy, UserCtx, useContext, useDocTitle, countryName, flag, BASE } from './lib.js';
import { Loading, Empty, Section, ErrorBox, Field, Confirm, TypedConfirm, Toggle, CodeBlock, Avatar, UpgradeLink } from './ui.js';
import { Snippet } from './dashboard.js';
import { useScope, organizationsOn } from './org.js';
import { brandTheme } from './brand.js';
import { importPlausible, removeImported } from './data-import.js';
import { SaveFooter, SettingsShell, firstError, zones } from './settings-common.js';
import { Alerts } from './settings-alerts.js';
import { Campaigns } from './settings-campaigns.js';
import { siteSettingsTabs, siteSettingsTab } from './shell-nav.js';

// Reads an export file in the browser (gzip or plain) and sends it in small batches, so file size never hits a server limit.
async function* exportLines(file) {
  let stream = file.stream();
  if (/\.gz$/i.test(file.name)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .gz files. Use a current version of Chrome, Firefox or Safari.');
    stream = stream.pipeThrough(new DecompressionStream('gzip'));
  }
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    rest += value || '';
    const parts = rest.split('\n');
    rest = done ? '' : parts.pop();
    for (const p of parts) if (p.trim()) yield p;
    if (done) { if (rest.trim()) yield rest; return; }
  }
}

function MoveData({ site, reload }) {
  const [state, setState] = useState(null);
  const run = async (file) => {
    const total = { imported: 0, events: 0, skipped: 0, outdated: 0, invalid: 0 };
    setState({ busy: true, ...total });
    let header = null; let batch = []; let bytes = 0; let first = true;
    const flush = async () => {
      if (!batch.length && !header) return;
      const r = await api(`/sites/${site.domain}/import`, { method: 'POST', body: { ...(first && header ? { header } : {}), visits: batch } });
      first = false; batch = []; bytes = 0;
      for (const k of Object.keys(total)) total[k] += r[k] || 0;
      setState({ busy: true, ...total });
    };
    try {
      let n = 0;
      for await (const line of exportLines(file)) {
        const row = JSON.parse(line);
        if (n++ === 0) { if (row.format !== 'tidemark-export') throw new Error('This is not a Tidemark export file.'); header = row; continue; }
        batch.push(row); bytes += line.length;
        if (batch.length >= 500 || bytes > 1.5e6) await flush();
      }
      if (n === 0) throw new Error('The file is empty.');
      await flush();
      setState({ done: true, ...total });
      reload();
    } catch (x) { setState({ error: firstError(x) || x.message, ...total }); }
  };
  const s = state || {};
  return html`<${Section} title="Move your data" help="Export this site's raw visits and events, or import an export from another Tidemark install, such as moving from self-hosted to Tidemark Cloud.">
    <div class="row wrap"><a class="btn" href=${`${BASE}/api/sites/${site.domain}/export/data`} download>Download export</a>
      <label class=${'btn ' + (s.busy ? 'disabled' : '')}>Import a file<input type="file" accept=".gz,.ndjson,.json" hidden disabled=${s.busy} onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) run(f); }} /></label></div>
    ${state && html`<div class=${'notice ' + (s.error ? 'danger' : '')} role="status"><div>${s.error ? html`Import stopped: ${s.error}. ` : s.done ? 'Import finished. ' : 'Importing… keep this tab open. '}${s.imported.toLocaleString()} visits and ${s.events.toLocaleString()} events added${s.skipped ? `, ${s.skipped.toLocaleString()} already here` : ''}${s.outdated ? `, ${s.outdated.toLocaleString()} older than your plan keeps` : ''}${s.invalid ? `, ${s.invalid.toLocaleString()} unreadable` : ''}.</div></div>`}<//>`;
}

function ImportPlausible({ site, reload }) {
  const [state, setState] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const bytes = (n) => (n >= 1e6 ? (n / 1e6).toFixed(0) + ' MB' : Math.round(n / 1e3) + ' KB');
  const run = async (file) => {
    setState({ busy: true, phase: 'Reading the file', done: 0, total: 1 });
    try {
      const r = await importPlausible(file, site.domain, (p) => setState({ busy: true, ...p }));
      setState({ result: r });
      reload();
    } catch (x) { setState({ error: firstError(x) || x.message }); reload(); }
  };
  const s = state || {};
  const imp = site.imported;
  const pct = s.total ? Math.min(100, Math.round((s.done / s.total) * 100)) : 0;
  return html`<${Section} title="Import from Plausible" help="Bring in your history from Plausible. In Plausible, open this site's Settings → Imports & exports, click Prepare download, then upload the .zip file here.">
    ${imp && html`<div class="notice"><${Icon} name="info" size=${16} /><div>Imported from Plausible: <b>${imp.start}</b> to <b>${imp.end}</b>. These days are added to your dashboard when no filter is applied.</div></div>`}
    <div class="row wrap">
      <label class=${'btn ' + (s.busy ? 'disabled' : '')}>${imp ? 'Import again' : 'Choose the .zip file'}<input type="file" accept=".zip,application/zip" hidden disabled=${s.busy} onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) run(f); }} /></label>
      ${imp && html`<button class="btn danger" disabled=${s.busy} onClick=${() => setConfirm(true)}>Remove imported data</button>`}</div>
    ${s.busy && html`<div class="stack sm" role="status"><div class="muted">${s.phase}… keep this tab open. ${s.sent ? s.sent.toLocaleString() + ' rows sent' : ''}</div><progress max="100" value=${pct} style="width:100%"></progress></div>`}
    ${s.error && html`<div class="notice danger" role="status"><div>Import stopped: ${s.error}</div></div>`}
    ${s.result && html`<div class="notice" role="status"><${Icon} name="check" size=${16} /><div>${s.result.days ? `Imported ${s.result.days.toLocaleString()} days (${s.result.from} to ${s.result.to}).` : 'Nothing was imported.'}${s.result.skipped ? ` ${s.result.skipped.toLocaleString()} rows were left out because they are older than your plan keeps or overlap days Tidemark already recorded.` : ''}${s.result.customProps ? ' Custom properties are not imported.' : ''}</div></div>`}
    <p class="muted small">Imported numbers are daily totals, so they appear in the graph, top stats and reports but not when you filter, and visitors are added up day by day. Importing again replaces the earlier import.</p>
    ${confirm && html`<${Confirm} title="Remove imported data?" message="The days imported from Plausible will be removed from this dashboard. What Tidemark collected itself is not touched." confirmLabel="Remove" onClose=${() => setConfirm(false)} onConfirm=${async () => { await removeImported(site.domain); setState(null); reload(); toast('Imported data removed'); }} />`}<//>`;
}

/** Collect even less: per-site switches that go beyond the defaults (no cookies, no stored IP addresses, no query strings). */
function PrivacyControls({ site, reload }) {
  const saved = (site.url_params || '').split(',').filter(Boolean).join(', ');
  const [params, setParams] = useState(saved);
  const [err, setErr] = useState(null);
  const patch = async (body) => { setErr(null); try { await api(`/sites/${site.domain}`, { method: 'PATCH', body }); reload(); toast('Saved'); } catch (x) { setErr(firstError(x)); } };
  const places = [['city', 'Country, region and city'], ['region', 'Country and region'], ['country', 'Country only']];
  const scrubChoice = (site.features || {}).pii_scrub !== false; // a host can require masking and hide the setting
  const masks = useApi(`/sites/${site.domain}/pii-masks`, null, [], { enabled: scrubChoice });
  const kinds = { email: ['email address', 'email addresses'], uuid: ['UUID', 'UUIDs'], number: ['long number', 'long numbers'], token: ['token', 'tokens'] };
  const masked = ((masks.data && masks.data.results) || []).map((r) => { const k = kinds[r.pattern] || [r.pattern, r.pattern]; return `${r.count.toLocaleString()} ${r.count === 1 ? k[0] : k[1]}`; }).join(', ');
  return html`<${Section} title="Privacy controls" help="Tidemark already sets no cookies, stores no IP addresses and drops query strings. These switches let you collect even less.">
    ${scrubChoice && html`<${Toggle} label="Mask personal data sent by accident" help="Email addresses, tokens, UUIDs and long numbers in page addresses, referrers, campaign values, event names and properties are replaced with a placeholder such as [email] before anything is stored. Ordinary page names and short ids are left alone." checked=${site.pii_scrub} onChange=${(v) => patch({ pii_scrub: v })} />`}
    ${scrubChoice && masked && html`<p class="muted small" style="margin:-4px 0 4px 48px">Masked in the last 30 days: ${masked}. Only these counts are kept, never the values.</p>`}
    <${Toggle} label="Respect Global Privacy Control" help="Visitors whose browser sends the Global Privacy Control signal are not counted." checked=${site.honor_gpc} onChange=${(v) => patch({ honor_gpc: v })} />
    <${Toggle} label="Respect Do Not Track" help="Visitors whose browser sends Do Not Track are not counted." checked=${site.honor_dnt} onChange=${(v) => patch({ honor_dnt: v })} />
    <${Toggle} label="Keep only the referrer's domain" help="Record news.example.org instead of news.example.org/story/42." checked=${site.referrer_domain_only} onChange=${(v) => patch({ referrer_domain_only: v })} />
    <${Field} label="Location detail" help="Where visitors are. Changing this affects visits recorded from now on."><select value=${site.location_precision || 'city'} onChange=${(e) => patch({ location_precision: e.target.value })} style="max-width:320px">${places.map(([k, l]) => html`<option value=${k} selected=${(site.location_precision || 'city') === k}>${l}</option>`)}</select><//>
    <${Field} label="Query parameters to keep" help="Page addresses are stored without their query string. List the parameters you want kept (for example page, lang), separated by commas, to see them in the Pages report. Names that look like they carry a secret or personal data, such as email or token, are refused."><div class="row"><input class="grow" placeholder="page, lang" value=${params} onInput=${(e) => setParams(e.target.value)} maxlength="2000" style="max-width:420px" /><button class="btn" type="button" disabled=${params.trim() === saved} onClick=${() => patch({ url_params: params.trim() || null })}>Save</button></div><//>
    ${err && html`<div class="alert">${err}</div>`}<//>`;
}

/** Crawlers, scripts, data center traffic, referrer spam and floods: left out of the numbers and counted here. */
function BotFiltering({ site, reload }) {
  const filtered = useApi(`/sites/${site.domain}/filtered`, null, []);
  const [err, setErr] = useState(null);
  const patch = async (body) => { setErr(null); try { await api(`/sites/${site.domain}`, { method: 'PATCH', body }); reload(); toast('Saved'); } catch (x) { setErr(firstError(x)); } };
  const names = { crawler: 'crawlers and known bots', headless: 'headless browsers and scripts', referrer_spam: 'referrer spam', datacenter: 'data center traffic', flood: 'floods from one visitor' };
  const rows = (filtered.data && filtered.data.results) || [];
  const total = rows.reduce((n, r) => n + r.count, 0);
  return html`<${Section} title="Bot and spam filtering" help="Hits that don't come from a person's browser are left out of your numbers, using only what the request already carries (never stored): known crawlers, headless browsers, addresses of cloud and hosting providers, referrer spam and sudden floods from a single visitor. Lists of providers and spam domains are updated with each release.">
    <${Toggle} label="Filter bots and spam" help="Turn it off to count everything, for example while testing from a script or a server." checked=${site.bot_filter !== false} onChange=${(v) => patch({ bot_filter: v })} />
    ${err && html`<div class="alert">${err}</div>`}
    ${filtered.data && html`<p class="muted small" style="margin:-4px 0 4px 48px">${total === 0 ? 'Nothing was filtered in the last 30 days.' : `Filtered in the last 30 days: ${total.toLocaleString()} (${rows.map((r) => `${r.count.toLocaleString()} ${names[r.reason] || r.reason}`).join(', ')}). Only these counts are kept.`}</p>`}
  <//>`;
}

/** How visits get in: the snippet, its extensions and the rules that drop traffic you don't want counted. */
function Tracking({ site, reload }) {
  const patch = async (body) => { try { await api(`/sites/${site.domain}`, { method: 'PATCH', body }); reload(); toast('Saved'); } catch (x) { toast(firstError(x), 'err'); } };
  return html`<${Section} title="Tracking snippet" help="Choose what your site runs on to see what to add."><${Snippet} site=${site} /><//>
    <${Section} title="Tracking extras" help="Each one adds a small extension to the script and a matching goal.">
      <${Toggle} label="Outbound link clicks" checked=${site.track_outbound} onChange=${(v) => patch({ track_outbound: v })} />
      <${Toggle} label="File downloads" checked=${site.track_downloads} onChange=${(v) => patch({ track_downloads: v })} />
      <${Toggle} label="Form submissions" checked=${site.track_forms} onChange=${(v) => patch({ track_forms: v })} />
      <${Toggle} label="Scroll depth and time on page" help="One extra event per page view as a visitor leaves it: how far they scrolled and how long they were active. It does not change bounce rate." checked=${site.track_engagement} onChange=${(v) => patch({ track_engagement: v })} /><//>
    ${!site.rollup && site.can_manage && html`<${PrivacyControls} site=${site} reload=${reload} />`}
    ${!site.rollup && site.can_manage && html`<${BotFiltering} site=${site} reload=${reload} />`}
    <${Shields} site=${site} />`;
}

/** What the dashboard counts as a conversion. */
const Conversions = ({ site }) => html`<${Goals} site=${site} /><${Funnels} site=${site} /><${EventDocs} site=${site} />`;

/** Who can see the site, and how it looks to them. */
const Access = ({ site, reload }) => html`${!site.rollup && html`<${People} site=${site} />`}<${Visibility} site=${site} reload=${reload} /><${Branding} site=${site} reload=${reload} />${!site.rollup && site.is_owner && organizationsOn() && html`<${MoveSite} site=${site} reload=${reload} />`}`;

const DELETE_DIMS = [['page', 'Page'], ['country', 'Country (two letters)'], ['source', 'Source'], ['utm_campaign', 'Campaign'], ['utm_source', 'UTM source'], ['utm_medium', 'UTM medium'], ['browser', 'Browser'], ['os', 'Operating system'], ['device', 'Device'], ['goal', 'Goal or event'], ['prop', 'Event property']];
const dimLabel = (d) => (d.startsWith('prop:') ? `Property ${d.slice(5)}` : (DELETE_DIMS.find((x) => x[0] === d) || [d, d])[1]);
const describeFilter = ([op, dim, values]) => `${dimLabel(dim)} ${op === 'contains' ? 'contains' : 'is'} ${values.join(', ')}`;

/** Site settings → Data → Delete by filter. Previews how many visits match, then deletes them whole after a typed confirmation. */
function DeleteByFilter({ site }) {
  const blank = { dim: 'page', op: 'is', value: '', key: '' };
  const [rows, setRows] = useState([blank]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const history = useApi(`/sites/${site.domain}/data/deletions`, null, [site.domain]);
  const body = () => ({
    filters: rows.filter((r) => r.value.trim() && (r.dim !== 'prop' || r.key.trim())).map((r) => [r.op, r.dim === 'prop' ? 'prop:' + r.key.trim() : r.dim, [r.value.trim()]]),
    from: from || undefined, to: to || undefined,
  });
  const edit = (i, patch) => { setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setFound(null); };
  const preview = async () => {
    setBusy(true);
    try { setFound(await api(`/sites/${site.domain}/data/preview`, { method: 'POST', body: body() })); } catch (x) { setFound(null); toast(firstError(x), 'err'); }
    setBusy(false);
  };
  const remove = async () => {
    const r = await api(`/sites/${site.domain}/data/delete`, { method: 'POST', body: { ...body(), confirm_visits: found.visits } });
    toast(`Deleted ${r.visits.toLocaleString()} ${r.visits === 1 ? 'visit' : 'visits'}`);
    setConfirm(false); setFound(null); history.reload();
  };
  return html`<${Section} title="Delete by filter" help="Remove collected visits that match conditions you choose, for example a page that leaked something or a day of test traffic. Everything in a matching visit goes with it, so reports stay consistent. Imported history is not touched."
    footer=${html`<span class="help">${found ? `${found.visits.toLocaleString()} ${found.visits === 1 ? 'visit' : 'visits'} and ${found.events.toLocaleString()} ${found.events === 1 ? 'event' : 'events'} match.` : 'Preview first: nothing is deleted until you confirm.'}</span>
      <div class="row"><button class="btn sm" disabled=${busy} onClick=${preview}>Preview</button>${found && found.visits > 0 && html`<button class="btn danger sm" onClick=${() => setConfirm(true)}>Delete…</button>`}</div>`}>
    <div class="stack sm">${rows.map((r, i) => html`<div class="row wrap" key=${i}>
      <select aria-label="Condition" value=${r.dim} onChange=${(e) => edit(i, { dim: e.target.value })} style="width:auto">${DELETE_DIMS.map(([k, l]) => html`<option value=${k} selected=${r.dim === k}>${l}</option>`)}</select>
      ${r.dim === 'prop' && html`<input aria-label="Property name" placeholder="Property name" value=${r.key} onInput=${(e) => edit(i, { key: e.target.value })} style="width:150px" />`}
      <select aria-label="Match" value=${r.op} onChange=${(e) => edit(i, { op: e.target.value })} style="width:auto"><option value="is" selected=${r.op === 'is'}>is</option><option value="contains" selected=${r.op === 'contains'}>contains</option></select>
      <input class="grow" aria-label="Value" placeholder=${r.dim === 'page' ? '/path or /blog/*' : 'Value'} value=${r.value} onInput=${(e) => edit(i, { value: e.target.value })} style="min-width:160px" />
      ${rows.length > 1 && html`<button class="btn ghost icon sm" aria-label="Remove condition" onClick=${() => { setRows(rows.filter((_, j) => j !== i)); setFound(null); }}><${Icon} name="x" size=${14} /></button>`}</div>`)}
      <div><button class="btn ghost sm" onClick=${() => { setRows([...rows, blank]); setFound(null); }}><${Icon} name="plus" size=${14} /> Add condition</button></div></div>
    <div class="row wrap"><label class="row"><span class="muted small">From</span><input type="date" value=${from} onInput=${(e) => { setFrom(e.target.value); setFound(null); }} aria-label="From date" style="width:auto" /></label>
      <label class="row"><span class="muted small">To</span><input type="date" value=${to} onInput=${(e) => { setTo(e.target.value); setFound(null); }} aria-label="To date" style="width:auto" /></label>
      <span class="muted small">Dates use the site's timezone (${site.timezone}).</span></div>
    ${history.data && history.data.data.length > 0 && html`<div class="stack sm"><b>Recent deletions</b>
      <table class="t stack-sm"><thead><tr><th>When</th><th>Who</th><th>What</th><th class="right">Visits</th><th class="right">Events</th></tr></thead>
        <tbody>${history.data.data.map((d) => html`<tr><td data-label="When" class="nowrap">${new Date(d.at).toLocaleString()}</td><td data-label="Who">${d.by}</td>
          <td data-label="What">${[...d.filters.map(describeFilter), d.date_from || d.date_to ? `Dates ${d.date_from || '…'} to ${d.date_to || '…'}` : null].filter(Boolean).join('; ')}</td>
          <td data-label="Visits" class="right num">${d.visits.toLocaleString()}</td><td data-label="Events" class="right num">${d.events.toLocaleString()}</td></tr>`)}</tbody></table></div>`}
    ${confirm && found && html`<${TypedConfirm} title="Delete matching visits?" phrase=${site.domain} confirmLabel="Delete visits" onClose=${() => setConfirm(false)} onConfirm=${remove}
      message=${`${found.visits.toLocaleString()} ${found.visits === 1 ? 'visit' : 'visits'} and ${found.events.toLocaleString()} ${found.events === 1 ? 'event' : 'events'} will be permanently deleted from ${site.domain}. This can't be undone.`} />`}
  <//>`;
}

function DataTab({ site, reload }) {
  const [tz, setTz] = useState(site.timezone);
  const [confirm, setConfirm] = useState(null);
  const patch = async (body) => { try { await api(`/sites/${site.domain}`, { method: 'PATCH', body }); reload(); toast('Saved'); } catch (x) { toast(firstError(x), 'err'); } };
  const tzCard = html`<${Section} title="Reporting timezone" help=${site.rollup ? 'Days start and end at midnight in this timezone. It starts as the timezone most of the rollup\'s sites use.' : 'Days start and end at midnight in this timezone.'}
    footer=${html`<${SaveFooter} help="Changing it re-draws the whole history in the new timezone." dirty=${tz !== site.timezone} onSave=${() => patch({ timezone: tz })} />`}>
    <select value=${tz} onChange=${(e) => setTz(e.target.value)} aria-label="Reporting timezone" style="max-width:360px">${zones().map((z) => html`<option value=${z} selected=${z === tz}>${z}</option>`)}</select><//>`;
  if (site.rollup) return html`${tzCard}
    ${site.is_owner && html`<${Section} danger title="Danger zone" help="Removing a rollup never touches the sites it adds up.">
      <div class="dz-row"><div><b>Delete rollup</b><span class="muted">Removes this dashboard and its goals.</span></div><button class="btn danger" onClick=${() => setConfirm('delete')}>Delete rollup</button></div><//>`}
    ${confirm === 'delete' && html`<${TypedConfirm} title=${`Delete ${site.domain}?`} phrase=${site.domain} message="The rollup and its goals will be deleted. The sites it adds up are not affected." confirmLabel="Delete rollup" onClose=${() => setConfirm(null)} onConfirm=${async () => { await api(`/sites/${site.domain}`, { method: 'DELETE' }); navigate('/sites'); }} />`}`;
  return html`${tzCard}
    ${site.can_manage && html`<${MoveData} site=${site} reload=${reload} />`}
    ${site.can_manage && html`<${DeleteByFilter} site=${site} />`}
    ${site.can_manage && html`<${ImportPlausible} site=${site} reload=${reload} />`}
    ${site.is_owner && html`<${Section} danger title="Danger zone" help="These actions cannot be undone.">
      <div class="dz-row"><div><b>Reset statistics</b><span class="muted">Deletes all collected data but keeps the site.</span></div><button class="btn danger" onClick=${() => setConfirm('reset')}>Reset statistics</button></div>
      <div class="dz-row"><div><b>Delete site</b><span class="muted">Removes the site and all its data permanently.</span></div><button class="btn danger" onClick=${() => setConfirm('delete')}>Delete site</button></div><//>`}
    ${confirm === 'reset' && html`<${TypedConfirm} title="Reset statistics?" phrase=${site.domain} message=${`All collected data for ${site.domain} will be deleted. This can't be undone.`} confirmLabel="Reset statistics" onClose=${() => setConfirm(null)} onConfirm=${async () => { await api(`/sites/${site.domain}/reset`, { method: 'POST' }); toast('Statistics reset'); reload(); }} />`}
    ${confirm === 'delete' && html`<${TypedConfirm} title=${`Delete ${site.domain}?`} phrase=${site.domain} message="The site and all of its data will be permanently deleted." confirmLabel="Delete site" onClose=${() => setConfirm(null)} onConfirm=${async () => { await api(`/sites/${site.domain}`, { method: 'DELETE' }); navigate('/sites'); }} />`}`;
}


const names = (list) => (list.length > 3 ? list.slice(0, 3).join(', ') + ` and ${list.length - 3} more` : list.join(', '));

/** Site settings → Sharing and access → Move to another organization. Shows who gains and loses access before anything happens. */
function MoveSite({ site, reload }) {
  const { user } = useContext(UserCtx);
  const scope = useScope(user);
  const res = useApi(`/sites/${site.domain}/move`, null, [site.domain, site.organization_id]);
  const [to, setTo] = useState('');
  const [confirm, setConfirm] = useState(false);
  const d = res.data;
  if (!d) return res.error ? null : html`<${Section} title="Move to another organization"><${Loading} /><//>`;
  const dest = d.destinations.find((x) => x.id === to);
  const i = dest && dest.impact;
  const label = (o) => (o.personal ? 'Personal' : o.name);
  const lines = i ? [
    i.owner_changes && `${i.new_owner} becomes the owner, so the site counts against their plan from now on.`,
    i.gains_access.length > 0 && `${names(i.gains_access)} gain${i.gains_access.length === 1 ? 's' : ''} access as organization admins.`,
    i.loses_access.length > 0 && `${names(i.loses_access)} lose${i.loses_access.length === 1 ? 's' : ''} the access they had through ${label(d.organization)}.`,
    i.teams.length > 0 && `Shared with ${names(i.teams.map((t) => `${t.name} (${t.members} ${t.members === 1 ? 'person' : 'people'})`))}: unshared, because teams belong to an organization.`,
    i.direct_people_kept > 0 && `The ${i.direct_people_kept} ${i.direct_people_kept === 1 ? 'person' : 'people'} you added to this site directly keep their access.`,
    ...(i.warnings || []),
    'Statistics, goals, shared links and alerts move with it.',
  ].filter(Boolean) : [];
  return html`<${Section} title="Move to another organization" help=${`This site is in ${label(d.organization)}. Moving it keeps its data and the people you added to it directly; access that came from the organization (its admins and teams) changes.`}>
    ${d.destinations.length === 0 ? html`<div class="empty-inline"><${Icon} name="shield" size=${18} /><div><b>Nowhere to move it</b><span>You can move a site between organizations you own or administer. Moving it out of an organization with a different owner takes that organization's owner.</span></div></div>`
      : html`<form class="goal-add-row" onSubmit=${(e) => { e.preventDefault(); setConfirm(true); }}><select class="grow" aria-label="Destination organization" value=${to} onChange=${(e) => setTo(e.target.value)}><option value="">Move to…</option>${d.destinations.map((o) => html`<option value=${o.id} selected=${to === o.id}>${label(o)}</option>`)}</select><button class="btn" disabled=${!to}>Review move</button></form>
        ${dest && html`<ul class="muted small" style="margin:0;padding-left:18px;display:grid;gap:4px">${lines.map((l) => html`<li>${l}</li>`)}</ul>`}`}
  <//>
  ${confirm && dest && html`<${Confirm} title=${`Move ${site.domain} to ${label(dest)}?`} confirmLabel="Move site" destructive=${false} message=${lines.join(' ')} onClose=${() => setConfirm(false)} onConfirm=${async () => { await api(`/sites/${site.domain}/move`, { method: 'POST', body: { organization: dest.id } }); scope.set(dest.id); setTo(''); reload(); res.reload(); toast(`Moved to ${label(dest)}`); }} />`}`;
}

/** Leave small groups out of what public dashboards and shared links list. */
function SmallGroups({ site, reload }) {
  const [n, setN] = useState(String(site.min_group_size || 0));
  const [err, setErr] = useState(null);
  const dirty = (parseInt(n, 10) || 0) !== (site.min_group_size || 0);
  const save = async () => { setErr(null); try { await api(`/sites/${site.domain}`, { method: 'PATCH', body: { min_group_size: parseInt(n, 10) || 0 } }); reload(); toast('Saved'); } catch (x) { setErr(firstError(x)); } };
  return html`<${Section} title="Small groups" help="With few visitors, one visit from a rare country or to an obscure page can point at one person. Set a minimum and public dashboards and shared links leave out rows with fewer visitors than that. You and the people on this site still see everything."
    footer=${html`<${SaveFooter} help="Totals and the graph still count everyone. A filter that would narrow a public view down to a smaller group shows no data." dirty=${dirty} onSave=${save} />`}>
    ${err && html`<div class="alert">${err}</div>`}
    <div class="row"><label class="sr-only" for="min-group">Smallest group to show</label><input id="min-group" type="number" min="0" max="1000" value=${n} onInput=${(e) => setN(e.target.value)} style="width:96px" /><span class="muted">visitors (0 turns it off, 5 is a common choice)</span></div><//>`;
}

function Visibility({ site, reload }) {
  const links = useApi(`/sites/${site.domain}/shared-links`, null, []);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(null);
  const setPublic = async (v) => { await api(`/sites/${site.domain}`, { method: 'PATCH', body: { public: v } }); reload(); };
  const url = (l) => `${window.SD.origin}/share/${site.domain}?auth=${l.slug}`;
  return html`<${Section} title="Public dashboard" help="Anyone with the address can view this site's stats, no sign-in needed."><${Toggle} label="Make the dashboard public" checked=${site.public} onChange=${setPublic} />
      ${site.public && html`<${CodeBlock} text=${`${window.SD.origin}/${site.domain}`} />`}<//>
    <${SmallGroups} site=${site} reload=${reload} />
    <${Section} title="Shared links" help="Private, read-only links you can revoke at any time. Add a password if you like.">
      ${!adding && html`<div class="section-actions"><button class="btn primary" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${14} /> New shared link</button></div>`}
      ${adding && html`<${NewLink} site=${site} onClose=${() => setAdding(false)} onDone=${() => { setAdding(false); links.reload(); toast('Shared link created'); }} />`}
      ${links.data && links.data.data.length === 0 && !adding && html`<div class="empty-inline"><${Icon} name="link" size=${18} /><div><b>No shared links yet</b><span>Create one to give someone read-only access without making the dashboard public. You can protect it with a password and delete it any time.</span></div></div>`}
      ${links.data && links.data.data.length > 0 && html`<ul class="rows" aria-label="Shared links">${links.data.data.map((l) => html`<li class="rowitem">
        <span class="ri-ico" aria-hidden="true"><${Icon} name=${l.password_protected ? 'lock' : 'link'} size=${16} /></span>
        <div class="grow ri-main"><b class="trunc">${l.name} ${l.password_protected && html`<span class="pill warn"><${Icon} name="lock" size=${11} /> Password</span>`}</b><span class="mono muted trunc">${url(l)}</span></div>
        <button class="btn sm" onClick=${() => copy(url(l))}><${Icon} name="copy" size=${13} /> Copy</button>
        <button class="btn ghost icon sm danger" aria-label=${'Delete shared link ' + l.name} title="Delete link" onClick=${() => setDel(l)}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
    <//>
    ${del && html`<${Confirm} title="Delete shared link?" message=${`Anyone using "${del.name}" will lose access immediately.`} onClose=${() => setDel(null)} onConfirm=${async () => { await api(`/sites/${site.domain}/shared-links/${del.id}`, { method: 'DELETE' }); links.reload(); }} />`}`;
}

const BRAND_PRESETS = ['#0e7c86', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0f172a'];
function Branding({ site, reload }) {
  const b = site.branding || { allowed: true, name: '', color: null, has_logo: false };
  const [name, setName] = useState(b.name || '');
  const [color, setColor] = useState(b.color || '');
  const [busy, setBusy] = useState(false);
  const valid = color === '' || /^#[0-9a-fA-F]{6}$/.test(color);
  const [hideName, setHideName] = useState(!!b.hide_name);
  const changed = name !== (b.name || '') || color !== (b.color || '') || hideName !== !!b.hide_name;
  const shown = (() => { if (!valid || !color) return { changed: false }; const l = brandTheme(color, false); const d = brandTheme(color, true); return { changed: l.changed || d.changed, light: l.accent, dark: d.accent }; })();
  const run = async (fn, ok) => { setBusy(true); try { await fn(); reload(); toast(ok); } catch (x) { toast(firstError(x), 'err'); } setBusy(false); };
  const save = () => run(() => api(`/sites/${site.domain}/branding`, { method: 'PATCH', body: { brand_name: name.trim(), brand_color: color, brand_hide_name: hideName } }), 'Saved');
  const upload = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const body = new FormData();
    body.append('logo', f);
    run(() => api(`/sites/${site.domain}/branding/logo`, { method: 'POST', body }), 'Logo updated');
  };
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const accent = valid && color ? ((dark ? shown.dark : shown.light) || color) : dark ? '#4fc3be' : '#0e7c86';
  const logo = site.brand && site.brand.logo;
  const off = !b.allowed;
  return html`<${Section} title="Branding" locked=${off} footer=${html`<${SaveFooter} help="Applies to the public dashboard and shared links." dirty=${changed && valid} busy=${busy} onSave=${save} label="Save changes" />`} help="Show your own logo, name and color to people who open the public dashboard or a shared link. A small “Analytics by Tidemark” link always stays in the footer.">
      <div class="brand-grid">
        <div class="brand-form">
          <div class="bf-field"><span class="lbl">Logo</span>
            <div class="logo-row">
              <span class="logo-tile">${logo ? html`<img src=${logo} alt="Current logo" />` : html`<${Icon} name="globe" size=${20} />`}</span>
              <div class="stack sm"><div class="row wrap">
                <label class=${'btn sm' + (off || busy ? ' disabled' : '')}>${b.has_logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled=${off || busy} onChange=${upload} /></label>
                ${b.has_logo && html`<button class="btn sm ghost danger" disabled=${off || busy} onClick=${() => run(() => api(`/sites/${site.domain}/branding/logo`, { method: 'DELETE' }), 'Logo removed')}>Remove</button>`}</div>
                <span class="help">PNG, JPEG, WebP or SVG, up to 100 KB. A wide logo about 28 pixels tall works best.</span></div></div></div>
          <${Field} label="Display name" help=${hideName && b.has_logo ? 'Not shown in the header. Visitors who use a screen reader or have images turned off get it as the logo’s description.' : 'Shown in the header next to (or instead of) the logo. Leave empty to keep the Tidemark logo.'}><input value=${name} maxlength="60" disabled=${off} onInput=${(e) => setName(e.target.value)} placeholder=${site.domain} /><//>
          <div class="bf-field"><label class="check"><input type="checkbox" checked=${hideName && !!b.has_logo} disabled=${off || !b.has_logo} onChange=${(e) => setHideName(e.target.checked)} />Show only the logo, not the name</label>
            <span class="help">${b.has_logo ? 'For a wordmark that already includes your name. The name above becomes the logo’s alt text.' : 'Upload a logo first. Without one, the name is what visitors see.'}</span></div>
          <div class="bf-field"><span class="lbl">Brand color</span>
            <div class="swatches" role="group" aria-label="Preset colors">${BRAND_PRESETS.map((c) => html`<button type="button" class=${'swatch' + (color.toLowerCase() === c ? ' on' : '')} style=${`--sw:${c}`} disabled=${off} aria-label=${'Use ' + c} title=${c} onClick=${() => setColor(c)}></button>`)}</div>
            <div class="row">
              <input type="color" value=${valid && color ? color : '#0e7c86'} disabled=${off} onInput=${(e) => setColor(e.target.value)} class="color-pick" aria-label="Pick a color" />
              <input value=${color} disabled=${off} onInput=${(e) => setColor(e.target.value.trim())} placeholder="#0e7c86" style="max-width:140px" class="mono" aria-label="Color hex code" />
              ${color && html`<button class="btn sm ghost" disabled=${off} onClick=${() => setColor('')}>Reset</button>`}</div>
            <span class="help">Used for buttons, links and the chart.</span>
            ${!valid && html`<span class="help" style="color:var(--bad)">Use six hex digits, like #0e7c86.</span>`}
            ${valid && color && shown.changed && html`<span class="help">So text stays readable (WCAG AA contrast), visitors see this as <b class="mono">${shown.light}</b> on light pages and <b class="mono">${shown.dark}</b> on dark ones, the closest shades that pass.</span>`}</div>
        </div>
        <div class="brand-side"><span class="lbl">Preview</span>
          <div class="bp" style=${`--bc:${accent}`} aria-hidden="true">
            <div class="bp-head">${logo ? html`<img src=${logo} alt="" />` : ''}<b>${hideName && logo ? '' : (name.trim() || (logo ? '' : site.domain))}</b><span class="bp-btn">Sign in</span></div>
            <div class="bp-body"><div class="bp-k"><em>Unique visitors</em><b>3,254</b></div>
              <svg viewBox="0 0 200 56" preserveAspectRatio="none"><path d="M0 44 L20 38 L40 40 L60 26 L80 30 L100 18 L120 24 L140 12 L160 20 L180 8 L200 14 L200 56 L0 56Z" class="a"/><path d="M0 44 L20 38 L40 40 L60 26 L80 30 L100 18 L120 24 L140 12 L160 20 L180 8 L200 14" class="l"/></svg></div>
            <div class="bp-foot">Analytics by Tidemark</div></div>
          ${!site.public && html`<p class="muted small">Branding shows on the public dashboard and shared links. This site's dashboard is private, so only shared links use it. <${Link} to=${`/${site.domain}/settings/access`}>Sharing settings<//></p>`}</div>
      </div>
    <//>`;
}

function NewLink({ site, onClose, onDone }) {
  const [f, setF] = useState({ name: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => { e.preventDefault(); setErr(null); setBusy(true); try { await api(`/sites/${site.domain}/shared-links`, { method: 'POST', body: { name: f.name, password: f.password || null } }); onDone(); } catch (x) { setErr(firstError(x)); setBusy(false); } };
  return html`<form class="goal-add" onSubmit=${save}>
    ${err && html`<div class="alert">${err}</div>`}
    <div class="fields2">
      <${Field} label="Name" help="Only you will see this."><input autofocus required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} placeholder="Marketing team" /><//>
      <${Field} label="Password (optional)" help="Visitors enter it before they see the dashboard."><input type="password" autocomplete="new-password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /><//>
    </div>
    <div class="row"><button class="btn primary" disabled=${!f.name || busy}>Create link</button><button type="button" class="btn" onClick=${onClose}>Cancel</button></div>
  </form>`;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'HKD', 'SGD', 'INR', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'];
const CurrencySelect = ({ value, onChange, disabled, label = 'Revenue currency', compact }) => html`<select class=${compact ? 'mini-select' : ''} value=${value || ''} onChange=${(e) => onChange(e.target.value || null)} disabled=${disabled} aria-label=${label} style="width:auto"><option value="" selected=${!value}>No revenue</option>${CURRENCIES.map((c) => html`<option value=${c} selected=${c === value}>${c}</option>`)}</select>`;

function Goals({ site }) {
  const res = useApi(`/sites/${site.domain}/goals`, null, []);
  const [type, setType] = useState('event');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState(null);
  const [err, setErr] = useState(null);
  const revenue = (site.features || {}).revenue !== false;
  const goals = (res.data && res.data.data) || [];
  const add = async (e) => {
    e.preventDefault(); setErr(null);
    try { await api(`/sites/${site.domain}/goals`, { method: 'POST', body: { type, value, currency: type === 'event' ? currency : null } }); setValue(''); setCurrency(null); res.reload(); } catch (x) { setErr(firstError(x)); }
  };
  const setGoalCurrency = async (g, c) => { setErr(null); try { await api(`/sites/${site.domain}/goals/${g.id}`, { method: 'PATCH', body: { currency: c } }); res.reload(); } catch (x) { setErr(firstError(x)); } };
  const remove = async (g) => { setErr(null); try { await api(`/sites/${site.domain}/goals/${g.id}`, { method: 'DELETE' }); res.reload(); } catch (x) { setErr(firstError(x)); } };
  return html`<${Section} title="Goals" help="A goal counts how many visitors did something: triggered a custom event, or visited a page.">
      <form class="goal-add" onSubmit=${add}>
        <div class="seg" role="radiogroup" aria-label="Goal type">${[['event', 'Custom event', 'mouse-pointer-click'], ['page', 'Page visit', 'eye']].map(([k, l, i]) => html`<button type="button" role="radio" aria-checked=${type === k} class=${type === k ? 'on' : ''} onClick=${() => setType(k)}><${Icon} name=${i} size=${14} />${l}</button>`)}</div>
        <div class="goal-add-row">
          <input class="grow" required placeholder=${type === 'event' ? 'Event name, e.g. Purchase' : 'Page path, e.g. /thanks or /blog/*'} value=${value} onInput=${(e) => setValue(e.target.value)} aria-label="Goal value" />
          ${type === 'event' && html`<${CurrencySelect} value=${currency} onChange=${setCurrency} disabled=${!revenue} />`}
          <button class="btn primary">Add goal</button>
        </div>
      </form>
      ${!revenue && html`<div class="notice"><${Icon} name="info" size=${16} /><div>Revenue reporting isn’t included in your plan. <${UpgradeLink} to="/settings/billing">Change your plan<//> to turn it on.</div></div>`}
      ${err && html`<div class="alert">${err}</div>`}
      ${res.data && goals.length === 0 && html`<div class="empty-inline"><${Icon} name="target" size=${18} /><div><b>No goals yet</b><span>Add the first one above. Outbound links, downloads and forms add their own when you turn them on under Tracking.</span></div></div>`}
      ${goals.length > 0 && html`<ul class="rows" aria-label="Goals">${goals.map((g) => html`<li class="rowitem">
        <span class="ri-ico" aria-hidden="true"><${Icon} name=${g.type === 'event' ? 'mouse-pointer-click' : 'eye'} size=${16} /></span>
        <div class="grow ri-main"><b class="trunc">${g.name}</b><span class="muted">${g.type === 'event' ? 'Custom event' : 'Page visit'}</span></div>
        ${g.type === 'event' && html`<${CurrencySelect} value=${g.currency} onChange=${(c) => setGoalCurrency(g, c)} disabled=${!revenue && !g.currency} label=${'Revenue currency for ' + g.name} compact />`}
        <button class="btn ghost icon sm danger" aria-label=${'Delete goal ' + g.name} title="Delete goal" onClick=${() => remove(g)}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
      ${site.rollup && html`<p class="muted small">Goals in a rollup match events and pages by name in every site it adds up. A goal with a currency adds up only the amounts the sites sent in that currency.</p>`}
    <//>`;
}

/** How to send events from your own code; sits under the goals it feeds. */
const EventDocs = ({ site }) => (site.rollup ? null : html`<${Section} title="Sending events from your code" help="Goals for custom events count when your site calls the script. Revenue goals also take an amount.">
    <div class="ref"><b>Record a conversion</b><${CodeBlock} text="window.plausible('Signup', { props: { plan: 'pro' } })" />
      <p class="muted small">Or tag an element without code: add <code>class="plausible-event-name=Signup"</code>, with the <code>tagged-events</code> script variant.</p></div>
    <div class="ref"><b>Report revenue</b><${CodeBlock} text="window.plausible('Purchase', { revenue: { amount: 29.99, currency: 'USD' } })" />
      <p class="muted small">Choose a currency for the goal above, then send an amount with the event; totals and averages appear when you filter by that goal. With the tag method, add <code>plausible-revenue-amount=29.99</code> and <code>plausible-revenue-currency=USD</code> to the class. Amounts in another currency are converted with the European Central Bank's daily rates.</p></div><//>`);

function Funnels({ site }) {
  const goals = useApi(`/sites/${site.domain}/goals`, null, []);
  const res = useApi(`/sites/${site.domain}/funnels`, null, []);
  const allowed = (site.features || {}).funnels !== false;
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const list = (goals.data && goals.data.data) || [];
  const funnels = (res.data && res.data.data) || [];
  const goalName = (id) => (list.find((g) => g.id === id) || { name: '(deleted goal)' }).name;
  const open = (f) => { setErr(null); setForm(f ? { id: f.id, name: f.name, steps: f.steps.map((s) => s.goal_id) } : { name: '', steps: ['', ''] }); };
  const save = async (e) => {
    e.preventDefault(); setErr(null);
    try {
      await api(`/sites/${site.domain}/funnels${form.id ? '/' + form.id : ''}`, { method: form.id ? 'PUT' : 'POST', body: { name: form.name, steps: form.steps } });
      setForm(null); res.reload(); toast('Funnel saved');
    } catch (x) { setErr(firstError(x)); }
  };
  const setStep = (i, v) => setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? v : s)) });
  const needGoals = allowed && goals.data && list.length < 2;
  return html`<${Section} title="Funnels" locked=${!allowed} help="A funnel follows visitors through a series of goals, in order, and shows where they drop off. Chain two to eight goals.">
      ${!form && html`<div class="section-actions"><button class="btn primary" disabled=${!allowed || list.length < 2} onClick=${() => open(null)}><${Icon} name="plus" size=${14} /> New funnel</button>${needGoals && html`<span class="muted small">Add at least two goals first.</span>`}</div>`}
      ${err && !form && html`<div class="alert">${err}</div>`}
      ${form && html`<form class="funnel-form" onSubmit=${save}>
        ${err && html`<div class="alert">${err}</div>`}
        <${Field} label="Name"><input required maxlength="100" autofocus value=${form.name} onInput=${(e) => setForm({ ...form, name: e.target.value })} placeholder="Signup to purchase" /><//>
        <div class="steps-edit"><span class="lbl">Steps</span>
          ${form.steps.map((id, i) => html`<div class="step-row"><span class="step-n" aria-hidden="true">${i + 1}</span>
            <select required class="grow" value=${id} onChange=${(e) => setStep(i, e.target.value)} aria-label=${'Step ' + (i + 1)}><option value="">Choose a goal</option>${list.map((g) => html`<option value=${g.id} selected=${g.id === id}>${g.name}</option>`)}</select>
            <button type="button" class="btn ghost icon sm" disabled=${form.steps.length <= 2} aria-label=${'Remove step ' + (i + 1)} title="Remove step" onClick=${() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}><${Icon} name="x" size=${15} /></button></div>`)}
          <div class="row spread wrap"><button type="button" class="btn sm" disabled=${form.steps.length >= 8} onClick=${() => setForm({ ...form, steps: [...form.steps, ''] })}><${Icon} name="plus" size=${13} /> Add step</button>
            <span class="muted small">A step counts when its goal happens after the one before; other activity in between is fine.</span></div></div>
        <div class="row"><button class="btn primary" disabled=${!form.name || form.steps.some((x) => !x)}>Save funnel</button><button type="button" class="btn" onClick=${() => setForm(null)}>Cancel</button></div></form>`}
      ${res.data && funnels.length === 0 && !form && html`<div class="empty-inline"><${Icon} name="funnel" size=${18} /><div><b>No funnels yet</b><span>Pick goals in the order visitors reach them, such as a pricing visit, a signup and a purchase, to see where they drop off.</span></div></div>`}
      ${funnels.length > 0 && html`<ul class="rows" aria-label="Funnels">${funnels.map((f) => html`<li class="rowitem funnel-item">
        <div class="grow ri-main"><b class="trunc">${f.name}</b>
          <ol class="chain">${f.steps.map((st, i) => html`<li>${i > 0 && html`<${Icon} name="chevron-right" size=${13} class="sep" />`}<span class="step-chip"><i>${i + 1}</i>${goalName(st.goal_id)}</span></li>`)}</ol></div>
        <button class="btn ghost icon sm" disabled=${!allowed} aria-label=${'Edit funnel ' + f.name} title="Edit funnel" onClick=${() => open(f)}><${Icon} name="pencil" size=${15} /></button>
        <button class="btn ghost icon sm danger" aria-label=${'Delete funnel ' + f.name} title="Delete funnel" onClick=${async () => { await api(`/sites/${site.domain}/funnels/${f.id}`, { method: 'DELETE' }); res.reload(); }}><${Icon} name="trash-2" size=${15} /></button></li>`)}</ul>`}
    <//>`;
}

/** Which of the owner's sites a rollup adds up. */
function RollupSites({ site, reload }) {
  const cands = useApi('/rollups/candidates' + (site.organization_id ? '?organization=' + site.organization_id : ''), null, [site.organization_id]);
  const [all, setAll] = useState(site.rollup.all);
  const [chosen, setChosen] = useState(site.rollup.sites.map((s) => s.domain));
  const [err, setErr] = useState(null);
  const list = (cands.data && cands.data.data) || [];
  const dirty = all !== site.rollup.all || (!all && JSON.stringify([...chosen].sort()) !== JSON.stringify(site.rollup.sites.map((s) => s.domain).sort()));
  const save = async () => { setErr(null); try { await api(`/sites/${site.domain}/rollup`, { method: 'PUT', body: { all, sites: all ? undefined : chosen } }); reload(); toast('Saved'); } catch (x) { setErr(firstError(x)); } };
  const members = site.rollup.sites.map((x) => x.domain);
  const count = all ? list.length || site.rollup.count : chosen.length;
  const toggle = (d, on) => setChosen(on ? [...chosen, d] : chosen.filter((x) => x !== d));
  const OPTIONS = [[true, organizationsOn() ? 'All the sites in this organization' : 'All your sites', 'layers', 'Includes the sites added later.'], [false, 'Only the sites I choose', 'funnel', 'Pick exactly which sites to add up.']];
  return html`<${Section} title="Sites in this rollup" footer=${html`<${SaveFooter} help=${`${count} ${count === 1 ? 'site' : 'sites'} in this rollup.`} dirty=${dirty && (all || chosen.length > 0)} onSave=${save} label="Save changes" />`} help="A rollup adds up the visits of several of your sites on one dashboard. Your sites themselves are never changed.">
    ${err && html`<div class="alert">${err}</div>`}
    <div class="opt-cards" role="radiogroup" aria-label="Which sites">${OPTIONS.map(([v, t, i, d]) => html`<button type="button" role="radio" aria-checked=${all === v} class=${'opt-card' + (all === v ? ' on' : '')} onClick=${() => { setAll(v); if (!v && !chosen.length) setChosen(list.map((x) => x.domain)); }}>
      <span class="ri-ico" aria-hidden="true"><${Icon} name=${i} size=${16} /></span><span class="oc-t"><b>${t}</b><span class="muted">${d}</span></span><span class="oc-dot" aria-hidden="true"></span></button>`)}</div>
    ${all ? html`<ul class="rows" aria-label="Sites in this rollup">${(list.length ? list.map((x) => x.domain) : members).map((d) => html`<li class="rowitem"><span class="ri-ico" aria-hidden="true"><${Icon} name="globe" size=${16} /></span><div class="grow ri-main"><b class="trunc">${d}</b></div><${Icon} name="check" size=${15} class="tick" /></li>`)}</ul>`
      : html`<div class="row spread wrap"><span class="muted small">${chosen.length} of ${list.length} selected</span><div class="row"><button type="button" class="btn sm ghost" onClick=${() => setChosen(list.map((x) => x.domain))}>Select all</button><button type="button" class="btn sm ghost" disabled=${!chosen.length} onClick=${() => setChosen([])}>Clear</button></div></div>
      <ul class="rows" role="group" aria-label="Sites in this rollup">${list.map((x) => html`<li class="rowitem pick"><label class="grow"><input type="checkbox" checked=${chosen.includes(x.domain)} onChange=${(e) => toggle(x.domain, e.target.checked)} /><span class="ri-ico" aria-hidden="true"><${Icon} name="globe" size=${16} /></span><b class="trunc">${x.domain}</b></label></li>`)}</ul>
      ${!list.length && cands.data && html`<div class="empty-inline"><${Icon} name="globe" size=${18} /><div><b>No sites to choose from</b><span>Add a site first, then come back to include it here.</span></div></div>`}`}
    ${dirty && html`<div class="notice"><${Icon} name="info" size=${16} /><div>Changing the list changes the whole history: a site you take out disappears from this dashboard's past as well as its future, and the other way round.</div></div>`}
  <//>`;
}

/** One field to give access: type a name to find one of the organization's teams, or an e-mail address to add or invite a person. */
function AccessAdd({ teams, canInvite, onTeam, onEmail }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('viewer');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const wrap = useRef();
  const text = q.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  const options = [
    ...teams.filter((t) => !text || t.name.toLowerCase().includes(text.toLowerCase())).slice(0, 6).map((t) => ({ key: 't' + t.id, icon: 'users', title: t.name, sub: `Team · ${t.members} ${t.members === 1 ? 'person' : 'people'} · all of them get access`, run: () => onTeam(t.id, role) })),
    ...(isEmail ? [{ key: 'e', icon: 'mail', title: (canInvite ? 'Add or invite ' : 'Add ') + text, sub: canInvite ? 'Access now, or an e-mail invitation if they have no account' : 'Must already have an account on this install', run: () => onEmail(text, role) }] : []),
  ];
  useEffect(() => {
    if (!open) return;
    const out = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  useEffect(() => setSel(0), [q]);
  const go = async (o) => { if (!o || busy) return; setBusy(true); const ok = await o.run(); if (ok !== false) { setQ(''); setOpen(false); } setBusy(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setSel((n) => Math.min(options.length - 1, n + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((n) => Math.max(0, n - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') { e.preventDefault(); if (text) go(options[sel]); }
  };
  return html`<div class="access-add"><div class="goal-add-row">
      <div class="pop-wrap grow" ref=${wrap}>
        <input type="text" role="combobox" aria-expanded=${open && options.length > 0} aria-controls="access-opts" autocomplete="off" spellcheck="false" placeholder=${teams.length ? 'Add a person by e-mail, or a team by name' : 'Add a person by e-mail address'} aria-label="Add a person or a team" value=${q} onFocus=${() => setOpen(true)} onInput=${(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown=${onKey} />
        ${open && options.length > 0 && html`<div class="switch-pop" style="width:100%" role="listbox" id="access-opts"><div class="cmd-list">${options.map((o, i) => html`<button type="button" role="option" aria-selected=${i === sel} class=${'cmd-item' + (i === sel ? ' on' : '')} style="min-height:44px" onMouseMove=${() => setSel(i)} onClick=${() => go(o)}>
          <${Icon} name=${o.icon} size=${15} /><span class="ri-main grow"><b class="trunc">${o.title}</b><span class="muted small trunc">${o.sub}</span></span></button>`)}</div></div>`}
      </div>
      <select class="fit" aria-label="Role to give" value=${role} onChange=${(e) => setRole(e.target.value)}><option value="viewer" selected=${role === 'viewer'}>Viewer</option><option value="admin" selected=${role === 'admin'}>Admin</option></select>
      <button type="button" class="btn primary" disabled=${!text || !options.length || busy} onClick=${() => go(options[sel])}>${isEmail && !teams.some((t) => t.name.toLowerCase().includes(text.toLowerCase())) ? (canInvite ? 'Add or invite' : 'Add') : options.length && !isEmail ? 'Add team' : 'Add'}</button>
    </div>
    <span class="muted small">${role === 'admin' ? 'Admins can see stats and change this site\'s settings.' : 'Viewers can see stats but not change anything.'}</span></div>`;
}

/** Site settings → Sharing and access → People with access: one list of everyone who can open the site and how they got access. */
function People({ site }) {
  const res = useApi(`/sites/${site.domain}/people`, null, []);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState({});
  const d = res.data || {};
  const people = d.data || [];
  const invites = d.invites || [];
  const teams = d.teams || [];
  const orgAdmins = d.organization_admins || [];
  const available = d.available_teams || [];
  const canInvite = !!d.invites_enabled;
  const isOwner = !!site.is_owner;
  const owner = people.find((u) => u.role === 'owner');
  const direct = people.filter((u) => u.role !== 'owner');
  const total = people.length + teams.length + orgAdmins.length + invites.length;
  const run = async (fn) => { setErr(null); try { await fn(); res.reload(); return true; } catch (x) { setErr(firstError(x)); return false; } };
  const left = (iso) => { const h = Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600000)); return h >= 2 ? `expires in ${h} hours` : 'expires within the hour'; };
  const roleSelect = (value, label, onChange) => html`<select class="mini-select" value=${value} aria-label=${label} onChange=${(e) => onChange(e.target.value)}><option value="viewer" selected=${value === 'viewer'}>Viewer</option><option value="admin" selected=${value === 'admin'}>Admin</option></select>`;
  const avatar = (u) => html`<${Avatar} name=${u.name || u.email} url=${u.avatar_url} />`;
  const tag = (t) => html`<span class="pill">${t}</span>`;
  const gap = html`<span class="ri-spacer" aria-hidden="true"></span>`;
  return html`<${Section} title="People with access" help=${res.data ? `${total} ${total === 1 ? 'person or group' : 'people and groups'} can open this site. ${canInvite ? 'Someone without an account gets an e-mail invitation that is valid for 72 hours.' : 'People need an account on this Tidemark install.'}` : 'Who can open this site, and how they got access.'}>
    <${AccessAdd} teams=${isOwner ? available : []} canInvite=${canInvite}
      onEmail=${(email, role) => run(async () => { const r = await api(`/sites/${site.domain}/people`, { method: 'POST', body: { email, role } }); toast(r.invited ? 'Invitation sent' : 'Added'); })}
      onTeam=${(id, role) => run(async () => { await api(`/sites/${site.domain}/teams`, { method: 'POST', body: { team_id: id, role } }); toast('Shared with the team'); })} />
    ${err && html`<div class="alert" role="alert">${err}</div>`}
    ${res.data && html`<ul class="rows" aria-label="People with access">
      ${owner && html`<li class="rowitem">${avatar(owner)}<div class="grow ri-main"><b class="trunc">${owner.name}</b><span class="muted trunc">${owner.email}</span></div><span class="pill brand">Owner</span>${gap}</li>`}
      ${orgAdmins.map((u) => html`<li class="rowitem">${avatar(u)}<div class="grow ri-main"><b class="trunc">${u.name}</b><span class="muted trunc">${u.email} · manages the whole organization</span></div>${tag('Organization admin')}${gap}</li>`)}
      ${teams.map((t) => html`<li class="rowitem access-team" style="flex-wrap:wrap">
        <span class="avatar" aria-hidden="true"><${Icon} name="users" size=${14} /></span>
        <div class="grow ri-main"><b class="trunc">${t.name}</b><span class="muted trunc">Team · ${t.members} ${t.members === 1 ? 'person' : 'people'}</span></div>
        <button class="btn ghost sm" aria-expanded=${!!open[t.id]} onClick=${() => setOpen({ ...open, [t.id]: !open[t.id] })}>${open[t.id] ? 'Hide' : 'Show'} people</button>
        ${isOwner ? html`${roleSelect(t.role, 'Role of team ' + t.name, (v) => run(() => api(`/sites/${site.domain}/teams/${t.id}`, { method: 'PATCH', body: { role: v } })))}
          <button class="btn ghost icon sm danger" aria-label=${'Stop sharing with ' + t.name} title="Stop sharing with this team" onClick=${() => run(() => api(`/sites/${site.domain}/teams/${t.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button>`
          : html`${tag(t.role === 'admin' ? 'Admin' : 'Viewer')}${gap}`}
        ${open[t.id] && html`<ul class="muted small" style="flex-basis:100%;margin:0 0 6px 40px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px">${t.member_names.length ? t.member_names.map((n) => html`<li>${n}</li>`) : html`<li>Nobody on this team yet.</li>`}${t.members > t.member_names.length && html`<li>and ${t.members - t.member_names.length} more</li>`}</ul>`}</li>`)}
      ${direct.map((u) => html`<li class="rowitem">${avatar(u)}<div class="grow ri-main"><b class="trunc">${u.name}</b><span class="muted trunc">${u.email}</span></div>
        ${roleSelect(u.role, 'Role of ' + u.name, (v) => run(() => api(`/sites/${site.domain}/people/${u.id}`, { method: 'PATCH', body: { role: v } })))}
        <button class="btn ghost icon sm danger" aria-label=${'Remove ' + u.name} title="Remove from this site" onClick=${() => run(() => api(`/sites/${site.domain}/people/${u.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}
      ${invites.map((i) => html`<li class="rowitem"><span class="avatar" aria-hidden="true"><${Icon} name="mail" size=${14} /></span><div class="grow ri-main"><b class="trunc">${i.email}</b><span class="muted trunc">Invited as ${i.role === 'admin' ? 'admin' : 'viewer'} · ${left(i.expires_at)}</span></div>
        <button class="btn ghost sm" disabled=${!canInvite} onClick=${() => run(async () => { await api(`/sites/${site.domain}/invites/${i.id}/resend`, { method: 'POST' }); toast('Invitation sent again'); })}>Resend</button>
        <button class="btn ghost icon sm danger" aria-label=${'Cancel invitation for ' + i.email} title="Cancel invitation" onClick=${() => run(() => api(`/sites/${site.domain}/invites/${i.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button></li>`)}
    </ul>
    <p class="muted small" style="margin:0">${organizationsOn() ? `Someone who gets access in more than one way (directly, through a team or as an organization admin) has the strongest role they were given.${isOwner ? ' Manage teams under Settings → Teams.' : ''}` : 'Someone who gets access in more than one way has the strongest role they were given.'}</p>`}
  <//>`;
}

const SHIELDS = [
  ['ip', 'IP address', '203.0.113.7 or 203.0.113.0/24', 'monitor', 'Visits from this address or range are not counted. Add your own to keep your visits out.'],
  ['country', 'Country', 'Two-letter code, e.g. DE', 'globe', 'Visits from this country are not counted.'],
  ['page', 'Page', '/admin/*', 'link', 'Views of matching pages are not counted. Use * as a wildcard.'],
  ['hostname', 'Hostname', 'example.com', 'shield-check', 'Only visits on these hostnames are counted, which helps if someone copies your script onto another site.'],
];
function Shields({ site }) {
  const res = useApi(`/sites/${site.domain}/shields`, null, []);
  const [type, setType] = useState('ip');
  const [value, setValue] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const add = async (e) => { e.preventDefault(); setErr(null); setBusy(true); try { await api(`/sites/${site.domain}/shields`, { method: 'POST', body: { type, value } }); setValue(''); res.reload(); } catch (x) { setErr(firstError(x)); } setBusy(false); };
  const remove = async (r) => { setErr(null); try { await api(`/sites/${site.domain}/shields/${r.id}`, { method: 'DELETE' }); res.reload(); } catch (x) { setErr(firstError(x)); } };
  const rows = res.data ? res.data.data : [];
  const kind = (t) => SHIELDS.find((x) => x[0] === t) || [t, t, '', 'shield', ''];
  const cur = kind(type);
  return html`<${Section} title="Shields" help="Keep traffic you don't want out of your numbers. Matching hits are dropped before they're stored.">
    <form class="goal-add" onSubmit=${add}>
      <div class="seg wrapseg" role="radiogroup" aria-label="Rule type">${SHIELDS.map(([k, l, , i]) => html`<button type="button" role="radio" aria-checked=${type === k} class=${type === k ? 'on' : ''} onClick=${() => setType(k)}><${Icon} name=${i} size=${14} />${l}</button>`)}</div>
      <div class="goal-add-row"><input class="grow" required placeholder=${cur[2]} value=${value} onInput=${(e) => setValue(e.target.value)} aria-label=${cur[1]} /><button class="btn primary" disabled=${!value.trim() || busy}>Add rule</button></div>
      <span class="muted small">${cur[4]}</span>
    </form>
    ${err && html`<div class="alert">${err}</div>`}
    ${res.data && !rows.length && html`<div class="empty-inline"><${Icon} name="shield" size=${18} /><div><b>No rules yet</b><span>Your site counts every visit. Add your own IP address to keep your visits out, or block a path like /admin/*.</span></div></div>`}
    ${rows.length > 0 && html`<ul class="rows" aria-label="Shield rules">${rows.map((r) => { const k = kind(r.type); return html`<li class="rowitem">
      <span class="ri-ico" aria-hidden="true"><${Icon} name=${k[3]} size=${16} /></span>
      <div class="grow ri-main"><b class="mono trunc">${r.type === 'country' ? `${flag(r.value)} ${countryName(r.value)} · ${r.value}` : r.value}</b><span class="muted">${r.type === 'hostname' ? 'Only count this hostname' : 'Blocked ' + k[1].toLowerCase()}</span></div>
      <button class="btn ghost icon sm danger" aria-label=${'Delete rule ' + r.value} title="Delete rule" onClick=${() => remove(r)}><${Icon} name="trash-2" size=${15} /></button></li>`; })}</ul>`}
  <//>`;
}

export function SiteSettings({ domain, tab }) {
  useDocTitle(domain + ' settings');
  const res = useApi(`/sites/${domain}`, null, [domain]);
  const s = res.data && res.data.data;
  if (res.error) return html`<main class="main"><${ErrorBox} error=${res.error} /></main>`;
  if (!s) return html`<main class="main"><${Loading} /></main>`;
  if (!s.can_manage) return html`<main class="main"><${Empty} title="No access" icon="lock">Only site owners and admins can change settings.<//></main>`;
  const tabs = siteSettingsTabs(s.rollup);
  const t = siteSettingsTab(s.rollup, tab);
  const Body = { tracking: Tracking, conversions: Conversions, alerts: Alerts, campaigns: Campaigns, access: Access, data: DataTab, sites: RollupSites }[t];
  return html`<${SettingsShell} title=${`${domain} settings`} back=${[`/${domain}`, 'Dashboard']} dup tabs=${tabs} tab=${t} base=${`/${domain}/settings`}><${Body} site=${s} reload=${res.reload} /><//>`;
}
