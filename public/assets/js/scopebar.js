// The scope bar: period, comparison, segment and filters in one sticky bar, with their menus, dialogs and keyboard shortcuts.
import { html, useState, useEffect, useRef, useApi, api, setQuery, setFilters, parseFilters, Link, Icon, toast, PERIODS, FILTER_OPS, FILTER_DIMS, dimLabel, todayStr, shiftDate, rememberPeriod, fmtShort, countryName, shareAuth, BASE, UserCtx, useContext } from './lib.js';
import { Pop, Modal, Field, useDebounced, UpgradeLink } from './ui.js';
import { registry } from './extensions.js';
import { stepPeriod, canStep, decodeZoom } from './scope-math.js';

/** Is this key press going into something the user is typing in? A field in the page, or a widget with its own fields (a chat widget keeps them in a shadow root, where the event's target is only the widget itself). */
export const typingIn = (e) => {
  const t = (e.composedPath && e.composedPath()[0]) || e.target;
  const is = (n) => n && (/input|textarea|select/i.test(n.tagName || '') || n.isContentEditable);
  return is(t) || is(e.target) || /-/.test((e.target && e.target.tagName) || '');
};

// ---------------------------------------------------------------------------------------------- filters
function FilterValueLabel({ dim, v }) { return dim === 'country' ? countryName(v) : v; }
const opLabel = (op) => (FILTER_OPS.find((o) => o[0] === op) || [0, op])[1];

let countryIdx;
/** "Germany" or "de" → "DE" so typed country names work as filter values. */
function countryCode(text) {
  const t = text.trim();
  if (/^[a-z]{2}$/i.test(t)) return t.toUpperCase();
  if (!countryIdx) {
    countryIdx = new Map();
    for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) { const c = String.fromCharCode(a, b); const n = countryName(c); if (n && n !== c) countryIdx.set(n.toLowerCase(), c); }
  }
  return countryIdx.get(t.toLowerCase()) || t;
}

const DIM_ICON = { page: 'file-text', entry_page: 'log-in', exit_page: 'log-out', hostname: 'server', channel: 'compass', source: 'external-link', referrer: 'link', country: 'globe', region: 'map-pin', city: 'map-pin', browser: 'monitor', os: 'laptop', device: 'smartphone', goal: 'target' };
const dimIcon = (d) => DIM_ICON[d] || 'tag';

function FilterMenu({ site, scope, initial, onClose, segs, onSave, onManage }) {
  const editing = initial && initial.index !== undefined;
  const [dim, setDim] = useState(initial ? initial.rule[1] : null);
  const [op, setOp] = useState(initial ? initial.rule[0] : 'is');
  const [values, setValues] = useState(initial ? initial.rule[2] : []);
  const [text, setText] = useState('');
  const [find, setFind] = useState('');
  const [hi, setHi] = useState(-1);
  const search = useDebounced(text, 200);
  const props = useApi(`/sites/${site.domain}/stats/props`, { period: 'all' }, []);
  const sugg = useApi(dim ? (dim === 'goal' ? `/sites/${site.domain}/stats/goals` : dim.startsWith('prop:') ? `/sites/${site.domain}/stats/props/${encodeURIComponent(dim.slice(5))}` : `/sites/${site.domain}/stats/breakdown/${dim}`) : null,
    { period: 'all', limit: dim === 'country' ? 250 : 8, search: dim === 'country' ? undefined : search || undefined }, [dim, search], { enabled: !!dim });
  const options = ((sugg.data && (sugg.data.results || [])) || []).filter((r) => !search || String(r.name).toLowerCase().includes(search.toLowerCase()) || (dim === 'country' && countryName(r.name).toLowerCase().includes(search.toLowerCase()))).filter((r) => !values.includes(r.name)).slice(0, 8);
  useEffect(() => setHi(-1), [search, dim]);
  const groups = [...FILTER_DIMS, ['Properties', ((props.data && props.data.results) || []).map((p) => ['prop:' + p.name, p.name])]].filter(([, l]) => l.length);
  const norm = (v) => (dim === 'country' ? countryCode(v) : String(v).trim());
  const add = (v) => { v = norm(v); if (v && !values.includes(v)) setValues([...values, v]); setText(''); };
  const apply = () => {
    const all = text.trim() ? [...values, norm(text)] : values;
    if (!all.length) return;
    const list = parseFilters(scope.query);
    const rule = [op, dim, all];
    if (editing) list[initial.index] = rule; else list.push(rule);
    setFilters(list.filter((r, i, a) => a.findIndex((x) => x[1] === r[1] && x[0] === r[0] && JSON.stringify(x[2]) === JSON.stringify(r[2])) === i));
    onClose();
  };
  const multi = dim !== 'goal';
  const OPS = FILTER_OPS.filter(([o]) => multi || o === 'is' || o === 'is_not');
  const results = (sugg.data && sugg.data.results) || [];
  const countOf = (n) => { const r = results.find((x) => x.name === n); return r ? r.visitors : undefined; };
  const typed = text.trim();
  const exact = typed && (values.includes(norm(typed)) || results.some((r) => String(r.name).toLowerCase() === typed.toLowerCase()));
  // selected values first (checked), then what the search suggests, then "add what I typed"
  const rows = [...values.map((v) => ({ name: v, on: true, visitors: countOf(v) })), ...options.map((r) => ({ name: r.name, on: false, visitors: r.visitors })), ...(typed && !exact && (dim !== 'country' || /^[a-z]{2}$/i.test(typed)) ? [{ name: norm(typed), on: false, custom: true }] : [])];
  const firstOff = rows.findIndex((r) => !r.on);
  const active = hi >= 0 ? hi : typed && firstOff >= 0 ? firstOff : -1;
  const applyWith = (vals) => {
    if (!vals.length) return;
    const list = parseFilters(scope.query);
    const rule = [op, dim, vals];
    if (editing) list[initial.index] = rule; else list.push(rule);
    setFilters(list.filter((r, i, a) => a.findIndex((x) => x[1] === r[1] && x[0] === r[0] && JSON.stringify(x[2]) === JSON.stringify(r[2])) === i));
    onClose();
  };
  const toggle = (row) => {
    if (!multi) return applyWith([row.name]);
    setValues(row.on ? values.filter((v) => v !== row.name) : [...values, row.name]);
    setText('');
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(rows.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(0, active - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && rows[active]) toggle(rows[active]); else apply(); }
    else if (e.key === 'Backspace' && !text && values.length && multi) setValues(values.slice(0, -1));
  };
  const segmentItems = segs && segs.allowed ? segs.list.filter((x) => x.name.toLowerCase().includes(find.toLowerCase())) : [];
  return html`<div class="pop filter-pop left" role="dialog" aria-label="Filter">
    <div class="fp-head">${dim && !editing ? html`<button class="btn ghost icon sm" aria-label="Back" onClick=${() => { setDim(null); setValues([]); setText(''); }}><${Icon} name="chevron-left" size=${15} /></button>` : null}${dim && html`<${Icon} name=${dimIcon(dim)} size=${15} class="fp-ico" />`}<b>${dim ? (editing ? 'Edit filter: ' + dimLabel(dim) : dimLabel(dim)) : 'Filter by'}</b></div>
    ${!dim ? html`<div class="searchbox"><${Icon} name="search" size=${14} /><input placeholder="Search filters" aria-label="Search filters" value=${find} onInput=${(e) => setFind(e.target.value)} autofocus /></div>
      <div class="filter-groups">${segs && segs.allowed && segmentItems.length > 0 && html`<div><div class="grp">Segments</div>
        ${segmentItems.map((x) => html`<button class="item" onClick=${() => { setFilters([...parseFilters(scope.query).filter((r) => r[1] !== 'segment'), ['is', 'segment', [x.id]]]); onClose(); }}><span class="item-l"><${Icon} name="bookmark" size=${14} />${x.name}</span>${x.type === 'site' && html`<span class="muted">Shared</span>`}</button>`)}</div>`}
      ${groups.map(([g, list]) => {
        const shown = list.filter(([, l]) => l.toLowerCase().includes(find.toLowerCase()));
        return shown.length ? html`<div><div class="grp">${g}</div>${shown.map(([k, l]) => html`<button class="item" onClick=${() => { setDim(k); setOp('is'); }}><span class="item-l"><${Icon} name=${dimIcon(k)} size=${14} />${l}</span></button>`)}</div>` : null;
      })}</div>
      ${segs && segs.allowed && site.role && html`<div class="fp-links">
        ${scope.filters.some((r) => r[1] !== 'segment') && html`<button class="item" onClick=${() => { onClose(); onSave(); }}><span class="item-l"><${Icon} name="plus" size=${14} />Save current filters as segment</span></button>`}
        <button class="item" onClick=${() => { onClose(); onManage(); }}><span class="item-l"><${Icon} name="settings" size=${14} />Manage segments</span></button></div>`}`
      : html`<div class="fp-form">
        <div class="fb-input"><select class="op-select" aria-label="Operator" value=${op} onChange=${(e) => setOp(e.target.value)}>${OPS.map(([o, l]) => html`<option value=${o} selected=${op === o}>${({ contains_not: 'excludes' })[o] || l}</option>`)}</select>
          <input value=${text} autofocus onInput=${(e) => setText(e.target.value)} onKeyDown=${onKey} placeholder=${'Search ' + dimLabel(dim).toLowerCase() + '…'} aria-label="Value" /></div>
        ${op.startsWith('contains') || dim === 'page' ? html`<span class="help fb-help">Use * as a wildcard, like /blog/*</span>` : null}
        <div class="fb-list" role="listbox" aria-label="Values" aria-multiselectable=${multi}>${rows.length === 0 && html`<div class="fb-empty">${sugg.loading ? 'Loading…' : 'Nothing to suggest yet. Type a value and press Enter.'}</div>`}
          ${rows.map((r, n) => html`<button role="option" aria-selected=${r.on} class=${'fb-row' + (n === active ? ' hot' : '') + (r.on ? ' sel' : '')} onMouseMove=${() => setHi(n)} onClick=${() => toggle(r)}>
            ${multi && html`<span class="fb-box" aria-hidden="true">${r.on && html`<${Icon} name="check" size=${12} />`}</span>`}
            <span class="trunc">${r.custom ? html`Add “${r.name}”` : html`<${FilterValueLabel} dim=${dim} v=${r.name} />`}</span>${r.visitors !== undefined && html`<em>${fmtShort(r.visitors)}</em>`}</button>`)}</div>
      </div>`}
    ${dim && multi && html`<div class="fp-foot"><span class="muted small">${values.length ? values.length + ' selected' : 'Pick one or more'}</span><button class="btn primary sm" onClick=${apply} disabled=${!values.length && !typed}>Apply filter</button></div>`}
  </div>`;
}

function FilterButton({ site, scope, filter, setFilter, segs, onSave, onManage }) {
  const ref = useRef();
  useEffect(() => {
    if (!filter) return;
    const out = (e) => ref.current && !ref.current.contains(e.target) && setFilter(null);
    const esc = (e) => e.key === 'Escape' && setFilter(null);
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [!!filter]);
  return html`<div class="pop-wrap" ref=${ref}>
    <button class="btn sb-filter" aria-haspopup="dialog" aria-expanded=${!!filter} onClick=${() => setFilter(filter ? null : {})}><${Icon} name="plus" size=${14} /> Filter</button>
    ${filter && html`<${FilterMenu} key=${filter.index ?? 'new'} site=${site} scope=${scope} initial=${filter.rule ? filter : null} onClose=${() => setFilter(null)} segs=${segs} onSave=${onSave} onManage=${onManage} />`}
  </div>`;
}

function FilterChips({ scope, edit, segs }) {
  const list = parseFilters(scope.query);
  if (!list.length) return null;
  const valueLabel = (dim, v) => (dim === 'country' ? countryName(v) : dim === 'segment' ? ((segs && segs.list.find((x) => x.id === v)) || { name: 'Unknown segment' }).name : v);
  return html`<div class="chips filter-chips" role="group" aria-label="Active filters">${list.map(([op, dim, vals], i) => html`<span class="chip">
    <button class="chip-edit" onClick=${() => dim !== 'segment' && edit({ index: i, rule: [op, dim, vals] })} title=${dim === 'segment' ? 'Segment' : 'Edit filter'}><${Icon} name=${dim === 'segment' ? 'bookmark' : dimIcon(dim)} size=${13} class="chip-ico" /><span>${dimLabel(dim)}</span><em>${opLabel(op)}</em><b>${vals.map((v) => valueLabel(dim, v)).join(' or ')}</b></button>
    <button aria-label=${'Remove filter ' + dimLabel(dim)} onClick=${() => setFilters(list.filter((_, j) => j !== i))}><${Icon} name="x" size=${12} /></button></span>`)}
  </div>`;
}

/** Name the current filters and keep them, for yourself or (owners and admins) for everyone who can see the site. */
function SaveSegment({ site, scope, segs, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('personal');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api(`/sites/${site.domain}/segments`, { method: 'POST', body: { name, type, filters: parseFilters(scope.query).filter((x) => x[1] !== 'segment') } });
      segs.reload(); setFilters([['is', 'segment', [r.data.id]]]); toast('Segment saved'); onClose();
    } catch (x) { setErr((x.body && x.body.errors && Object.values(x.body.errors)[0][0]) || x.message); setBusy(false); }
  };
  return html`<${Modal} title="Save as segment" onClose=${onClose} footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" disabled=${!name.trim() || busy} onClick=${save}>Save segment</button>`}>
    <div class="form">${err && html`<div class="alert">${err}</div>`}
      <div class="seg-sum"><span class="lbl">Filters saved</span>
        <div class="chips">${parseFilters(scope.query).filter((r) => r[1] !== 'segment').map(([op, dim, vals]) => html`<span class="chip static"><${Icon} name=${dimIcon(dim)} size=${13} class="chip-ico" /><span>${dimLabel(dim)}</span><em>${opLabel(op)}</em><b>${vals.map((v) => (dim === 'country' ? countryName(v) : v)).join(' or ')}</b></span>`)}</div></div>
      <${Field} label="Name"><input autofocus maxlength="100" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Visitors from Germany" /><//>
      <div class="bf-field"><span class="lbl">Who can use it</span>
        <div class="seg" role="radiogroup" aria-label="Who can use it">${[['personal', 'Only me', 'user'], ...(site.can_manage ? [['site', 'Everyone who can see this site', 'users']] : [])].map(([k, l, i]) => html`<button type="button" role="radio" aria-checked=${type === k} class=${type === k ? 'on' : ''} onClick=${() => setType(k)}><${Icon} name=${i} size=${14} />${l}</button>`)}</div></div>
      <p class="muted small">Pick it from the Filter menu any time.</p></div><//>`;
}

function ManageSegments({ site, scope, segs, onClose }) {
  const [err, setErr] = useState(null);
  const [names, setNames] = useState({});
  const current = parseFilters(scope.query).filter((x) => x[1] !== 'segment');
  const run = async (fn) => { setErr(null); try { await fn(); segs.reload(); } catch (x) { setErr(x.message); } };
  const can = (x) => x.type === 'site' ? site.can_manage : x.mine;
  return html`<${Modal} title="Segments" onClose=${onClose} wide footer=${html`<button class="btn" onClick=${onClose}>Done</button>`}>
    ${err && html`<div class="alert">${err}</div>`}
    ${!segs.list.length && html`<p class="muted">No segments yet. Add some filters, then choose Save as segment.</p>`}
    ${segs.list.length > 0 && html`<ul class="rows" aria-label="Segments">${segs.list.map((x) => html`<li class="rowitem">
      <span class="ri-ico" aria-hidden="true"><${Icon} name="bookmark" size=${16} /></span>
      <div class="grow ri-main"><input class="seg-name" aria-label=${'Name of ' + x.name} value=${names[x.id] ?? x.name} disabled=${!can(x)} maxlength="100" onInput=${(e) => setNames({ ...names, [x.id]: e.target.value })} onBlur=${() => names[x.id] && names[x.id] !== x.name && run(() => api(`/sites/${site.domain}/segments/${x.id}`, { method: 'PATCH', body: { name: names[x.id] } }))} /><span class="muted small">${x.type === 'site' ? 'Shared with everyone who can see this site' : 'Only you'}</span></div>
      ${can(x) && html`<button class="btn sm ghost" disabled=${!current.length} title=${current.length ? 'Replace the saved filters with the ones on screen' : 'Apply some filters first'} onClick=${() => run(() => api(`/sites/${site.domain}/segments/${x.id}`, { method: 'PATCH', body: { filters: current } }).then(() => toast('Segment updated')))}>Use current filters</button>
        <button class="btn ghost icon sm danger" aria-label=${'Delete ' + x.name} title="Delete segment" onClick=${() => run(() => api(`/sites/${site.domain}/segments/${x.id}`, { method: 'DELETE' }))}><${Icon} name="trash-2" size=${15} /></button>`}</li>`)}</ul>`}<//>`;
}


// ------------------------------------------------------------------------------------------- period label
export function periodLabel(scope, site) {
  const { query, period } = scope;
  const today = todayStr(site.timezone);
  const date = query.date || today;
  const fmtDay = (d, o) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', ...o });
  if (period === 'day') return date === today ? 'Today' : date === shiftDate(today, 'day', -1) ? 'Yesterday' : fmtDay(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (period === 'month') return date.slice(0, 7) === today.slice(0, 7) ? 'Month to date' : date.slice(0, 7) === shiftDate(today.slice(0, 8) + '01', 'month', -1).slice(0, 7) ? 'Last month' : fmtDay(date, { month: 'long', year: 'numeric' });
  if (period === 'year') return date.slice(0, 4) === today.slice(0, 4) ? 'Year to date' : date.slice(0, 4);
  if (period === 'custom') return query.from && query.to ? `${fmtDay(query.from, { month: 'short', day: 'numeric' })} – ${fmtDay(query.to, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Custom range';
  return (PERIODS.find((p) => p[0] === period) || [0, { '30d': 'Last 30 days', '6mo': 'Last 6 months' }[period] || 'Last 28 days'])[1];
}

// ------------------------------------------------------------------------------------------------ labels
/** "26 Sep - 23 Oct", or with the year when the window crosses years. `p` is a period object from the API ({ from, to }). */
export function rangeLabel(p) {
  const a = p.from.slice(0, 10), b = p.to.slice(0, 10);
  const f = (d, y) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) });
  const y = a.slice(0, 4) !== b.slice(0, 4) || a.slice(0, 4) !== new Date().getFullYear().toString();
  return a === b ? f(a, y) : `${f(a, y)} - ${f(b, y)}`;
}
export const COMPARISONS = [['previous_period', 'Previous period'], ['year_over_year', 'Previous year'], ['off', 'No comparison']];

// ------------------------------------------------------------------------------------------------ calendar
/** A month grid for picking a range: click the first day, then the last. */
function RangeCalendar({ today, from: f0, to: t0, onApply }) {
  const [month, setMonth] = useState((t0 || today).slice(0, 7));
  const [a, setA] = useState(f0 || null);
  const [b, setB] = useState(t0 || null);
  const [hover, setHover] = useState(null);
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // weeks start on Monday
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const end = b || (a && hover) || null;
  const lo = a && end ? (a < end ? a : end) : a, hi = a && end ? (a < end ? end : a) : a;
  const pick = (d) => { if (!a || b) { setA(d); setB(null); } else if (d < a) { setB(a); setA(d); } else setB(d); };
  const move = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const nice = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return html`<div class="cal">
    <div class="cal-h"><button type="button" class="btn ghost icon sm" aria-label="Previous month" onClick=${() => move(-1)}><${Icon} name="chevron-left" size=${15} /></button><b aria-live="polite">${title}</b>
      <button type="button" class="btn ghost icon sm" aria-label="Next month" disabled=${month >= today.slice(0, 7)} onClick=${() => move(1)}><${Icon} name="chevron-right" size=${15} /></button></div>
    <div class="cal-g" role="group" aria-label=${title}>${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => html`<span class="cal-w" aria-hidden="true">${d}</span>`)}
      ${cells.map((d) => (d ? html`<button type="button" class=${'cal-d' + (lo && d >= lo && d <= hi ? ' in' : '') + (d === lo || d === hi ? ' end' : '') + (d === today ? ' today' : '')} disabled=${d > today} aria-pressed=${d === lo || d === hi}
        aria-label=${new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { dateStyle: 'full', timeZone: 'UTC' })} onMouseEnter=${() => setHover(d)} onFocus=${() => setHover(d)} onClick=${() => pick(d)}>${Number(d.slice(8))}</button>` : html`<span></span>`))}</div>
    <div class="cal-f"><span class="muted small">${a ? (b && b !== a ? nice(a) + ' – ' + nice(b) : nice(a)) : 'Pick a first day'}</span>
      <button type="button" class="btn primary sm" disabled=${!a} onClick=${() => { const s = a, e = b || a; onApply(s < e ? s : e, s < e ? e : s); }}>Apply</button></div>
  </div>`;
}

// ------------------------------------------------------------------------------------------------ period
function PeriodControl({ site, scope, today, step }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const { query, period } = scope;
  const date = query.date || today;
  const yesterday = shiftDate(today, 'day', -1);
  const lastMonth = shiftDate(today.slice(0, 8) + '01', 'month', -1);
  const choose = (p) => {
    const q = { period: p, date: null, from: null, to: null, interval: null, zoom: null };
    if (p === 'yesterday') Object.assign(q, { period: 'day', date: yesterday });
    else if (p === 'last_month') Object.assign(q, { period: 'month', date: lastMonth });
    if (!['yesterday', 'last_month', 'realtime'].includes(p)) rememberPeriod(site, p); // a past day or month is not worth remembering
    setQuery(q); setOpen(false); setCustom(false);
  };
  const isOn = (k) => (k === 'day' ? period === 'day' && date === today : k === 'yesterday' ? period === 'day' && date === yesterday : k === 'month' ? period === 'month' && date.slice(0, 7) === today.slice(0, 7) : k === 'last_month' ? period === 'month' && date.slice(0, 7) === lastMonth.slice(0, 7) : k === period);
  useEffect(() => {
    const h = (e) => { const c = e.detail || {}; if (c.type === 'period') { if (c.key === 'custom') { setOpen(true); setCustom(true); } else choose(c.key); } };
    window.addEventListener('tdm:cmd', h);
    return () => window.removeEventListener('tdm:cmd', h);
  });
  useEffect(() => { if (!open) setCustom(false); }, [open]);
  useEffect(() => { if (!document.__sbOpenCustom) return; }, []);
  const canPrev = scope.comparable && canStep(period, query, today, -1), canNext = scope.comparable && canStep(period, query, today, 1);
  return html`<div class="sb-group" role="group" aria-label="Period">
    <button class="btn icon sb-step" aria-label="Previous period" title="Previous period ([)" disabled=${!canPrev} onClick=${() => step(-1)}><${Icon} name="chevron-left" size=${15} /></button>
    <${Pop} open=${open} setOpen=${setOpen} align="left" ariaLabel=${'Period: ' + periodLabel(scope, site)} btnClass="btn sb-period" label=${html`<${Icon} name="calendar" size=${14} /><span class="sb-val">${periodLabel(scope, site)}</span><${Icon} name="chevron-down" size=${13} class="muted" />`}>
      ${() => html`<div class=${'sb-menu' + (custom ? ' with-cal' : '')}>
        <div class="sb-presets">${PERIODS.filter((p) => p[0] !== 'custom').map(([k, l, key]) => html`<button class=${'item ' + (isOn(k) ? 'on' : '')} onClick=${() => choose(k)}><span>${l}</span>${isOn(k) ? html`<${Icon} name="check" size=${14} class="check" />` : key ? html`<kbd>${key}</kbd>` : null}</button>`)}
          <button class=${'item ' + (period === 'custom' || custom ? 'on' : '')} onClick=${() => setCustom(!custom)} aria-expanded=${custom}><span>Custom range</span><kbd>U</kbd></button></div>
        ${custom && html`<${RangeCalendar} today=${today} from=${query.from} to=${query.to} onApply=${(from, to) => { setQuery({ period: 'custom', from, to, date: null, interval: null, zoom: null }); setOpen(false); }} />`}
      </div>`}
    <//>
    <button class="btn icon sb-step" aria-label="Next period" title="Next period (])" disabled=${!canNext} onClick=${() => step(1)}><${Icon} name="chevron-right" size=${15} /></button>
  </div>`;
}

function CompareControl({ scope, toggle }) {
  const cur = scope.comparison || 'off';
  const set = (v, close) => { setQuery({ comparison: v === 'previous_period' ? null : v }); close(); };
  const label = scope.comparable ? (cur === 'off' ? 'Compare: off' : cur === 'year_over_year' ? 'vs previous year' : 'vs previous period') : 'Compare';
  return html`<${Pop} align="left" ariaLabel=${'Comparison: ' + label} btnClass=${'btn sb-compare' + (cur !== 'off' ? ' on' : '')} label=${html`<${Icon} name="git-compare" size=${14} /><span class="sb-val">${label}</span><${Icon} name="chevron-down" size=${13} class="muted" />`}>
    ${(close) => html`<div style="min-width:220px">
      ${!scope.comparable ? html`<p class="muted small" style="padding:8px 10px">Comparison isn't available for ${scope.period === 'realtime' ? 'realtime' : 'all time'}.</p>` : COMPARISONS.map(([k, l]) => html`<button class=${'item ' + (cur === k ? 'on' : '')} onClick=${() => set(k, close)}><span>${l}</span>${cur === k ? html`<${Icon} name="check" size=${14} class="check" />` : k === 'off' ? html`<kbd>C</kbd>` : null}</button>`)}
    </div>`}
  <//>`;
}

const billingPath = () => (registry.accountTabs.some((x) => x.key === 'billing') ? '/settings/billing' : '/settings');

function SegmentControl({ site, scope, segs, locked, onSave, onManage }) {
  const active = scope.filters.find((r) => r[1] === 'segment');
  const current = active && segs && segs.list.find((x) => x.id === active[2][0]);
  const label = locked ? 'Segment' : current ? current.name : active ? 'Segment' : 'All visitors';
  const filtersNow = scope.filters.some((r) => r[1] !== 'segment');
  const choose = (id, close) => { setFilters([...parseFilters(scope.query).filter((r) => r[1] !== 'segment'), ...(id ? [['is', 'segment', [id]]] : [])]); close(); };
  return html`<${Pop} align="left" ariaLabel=${'Segment: ' + label} btnClass=${'btn sb-segment' + (active ? ' on' : '')} label=${html`<${Icon} name=${locked ? 'lock' : 'users'} size=${14} /><span class="sb-val">${label}</span>${locked && html`<span class="badge outline">Pro</span>`}<${Icon} name="chevron-down" size=${13} class="muted" />`}>
    ${(close) => (locked ? html`<div class="sb-lock"><span class="prolock-ico" aria-hidden="true"><${Icon} name="lock" size=${18} /></span><b>Segments are a Pro feature</b>
        <p class="muted small">Save any set of filters, like “visitors from Germany on mobile”, and switch between them in one click.</p>
        ${site.can_manage && html`<${UpgradeLink} to=${billingPath()} class="btn primary sm" onClick=${close}>Upgrade to unlock<//>`}</div>`
      : html`<div style="min-width:240px">
        <button class=${'item ' + (!active ? 'on' : '')} onClick=${() => choose(null, close)}><span>All visitors</span>${!active && html`<${Icon} name="check" size=${14} class="check" />`}</button>
        ${segs && segs.list.length > 0 && html`<div class="grp">Saved segments</div>${segs.list.map((x) => html`<button class=${'item ' + (active && active[2][0] === x.id ? 'on' : '')} onClick=${() => choose(x.id, close)}><span class="trunc">${x.name}</span>${active && active[2][0] === x.id ? html`<${Icon} name="check" size=${14} class="check" />` : x.type === 'site' ? html`<span class="muted small">Shared</span>` : null}</button>`)}`}
        ${segs && segs.list.length === 0 && html`<p class="muted small" style="padding:6px 10px 2px">No saved segments yet.</p>`}
        ${site.role && html`<hr />${filtersNow && html`<button class="item" onClick=${() => { close(); onSave(); }}><span>Save current filters…</span><${Icon} name="plus" size=${14} /></button>`}
          <button class="item" onClick=${() => { close(); onManage(); }}><span>Manage segments</span><${Icon} name="settings" size=${14} /></button>`}
      </div>`)}
  <//>`;
}

function ExportMenu({ site, scope }) {
  const exportUrl = () => {
    const q = new URLSearchParams(scope.params);
    const a = shareAuth(); if (a) q.set('auth', a);
    return `${BASE}/api/sites/${site.domain}/stats/export?${q}`;
  };
  return html`<${Pop} align="right" ariaLabel="More" btnClass="btn icon" label=${html`<${Icon} name="ellipsis" size=${16} />`}>
    ${(close) => html`<div style="min-width:220px">
      <a class="item" href=${exportUrl()} download onClick=${close}><span>Export everything (CSV)</span><${Icon} name="download" size=${14} /></a>
      ${site.can_manage && html`<${Link} to=${`/${site.domain}/settings`} class="item" onClick=${close}><span>Site settings</span><${Icon} name="settings" size=${14} /><//>`}
    </div>`}<//>`;
}

/** Segments for the signed-in user. Public and shared viewers have none. */
function useSegments(site, user) {
  const on = !!(user && site.features && site.features.segments);
  const res = useApi(on ? `/sites/${site.domain}/segments` : null, null, [site.domain, on], { enabled: on });
  return on ? { allowed: !res.data || res.data.allowed !== false, list: (res.data && res.data.data) || [], reload: res.reload } : null;
}

// ------------------------------------------------------------------------------------------------ the bar
/**
 * ONE sticky bar for everything that scopes a report: period (presets and calendar), comparison, segment, filters.
 * All of it lives in the URL (period, date, from, to, comparison, filters, zoom), so a copied link reproduces the view and the back
 * button steps through changes. Keys: [ ] previous/next period, t today, c comparison, the period letters, / and the arrows.
 */
export function ScopeBar({ site, scope }) {
  const { user } = useContext(UserCtx) || {};
  const [filter, setFilter] = useState(null);
  const [dialog, setDialog] = useState(null);
  const segs = useSegments(site, user);
  const locked = !!(user && site.features && site.features.segments === false && site.can_manage);
  const today = todayStr(site.timezone);
  const { query, period } = scope;
  const zoomed = !!query.zoom && ['custom', 'day'].includes(period);
  const step = (dir) => { const p = stepPeriod(period, query, today, dir); if (p) setQuery({ ...p, zoom: null }); };
  const toggleCompare = () => scope.comparable && setQuery({ comparison: scope.comparison ? 'off' : null });
  const resetZoom = () => { const p = decodeZoom(query.zoom); if (p) setQuery(p); };
  useEffect(() => {
    const k = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e) || document.querySelector('.overlay, .sheet')) return;
      const key = e.key.toUpperCase();
      if (e.key === '[') { e.preventDefault(); step(-1); }
      else if (e.key === ']') { e.preventDefault(); step(1); }
      else if (key === 'T') { e.preventDefault(); setQuery({ period: 'day', date: null, from: null, to: null, interval: null, zoom: null }); }
      else if (key === 'C' || key === 'X') { e.preventDefault(); toggleCompare(); }
      else if (e.key === 'ArrowLeft' && ['day', 'month', 'year'].includes(period)) step(-1);
      else if (e.key === 'ArrowRight' && ['day', 'month', 'year'].includes(period)) step(1);
      else { const hit = PERIODS.find((p) => p[2] === key && p[0] !== 'day' || p[2] === key && p[0] === 'day'); if (hit) { e.preventDefault(); if (hit[0] === 'custom') window.dispatchEvent(new CustomEvent('tdm:cmd', { detail: { type: 'period', key: 'custom' } })); else window.dispatchEvent(new CustomEvent('tdm:cmd', { detail: { type: 'period', key: hit[0] } })); } }
    };
    document.addEventListener('keydown', k);
    const h = (e) => {
      const c = e.detail || {};
      if (c.type === 'compare') toggleCompare();
      else if (c.type === 'filter') setFilter({});
      else if (c.type === 'step') step(c.dir);
      else if (c.type === 'zoom-reset') resetZoom();
      else if (c.type === 'reset') reset();
      else if (c.type === 'export') { const q = new URLSearchParams(scope.params); const a = shareAuth(); if (a) q.set('auth', a); window.location.assign(`${BASE}/api/sites/${site.domain}/stats/export?${q}`); }
    };
    window.addEventListener('tdm:cmd', h);
    return () => { document.removeEventListener('keydown', k); window.removeEventListener('tdm:cmd', h); };
  });
  useEffect(() => {
    const onScroll = () => { const t = document.querySelector('.scopebar'); if (t) t.classList.toggle('raised', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const reset = () => { const z = decodeZoom(query.zoom); setQuery({ filters: null, ...(z || {}) }); };
  const hasChips = scope.filters.length > 0 || zoomed;
  return html`<div class="scopebar" role="region" aria-label="Scope: period, comparison, segment and filters">
    <div class="sb-row">
      <${PeriodControl} site=${site} scope=${scope} today=${today} step=${step} />
      <${CompareControl} scope=${scope} />
      ${(segs || locked) && html`<${SegmentControl} site=${site} scope=${scope} segs=${segs} locked=${locked && !segs} onSave=${() => setDialog('save')} onManage=${() => setDialog('manage')} />`}
      <${FilterButton} site=${site} scope=${scope} filter=${filter} setFilter=${setFilter} segs=${segs} onSave=${() => setDialog('save')} onManage=${() => setDialog('manage')} />
      <span class="grow"></span>
      <${ExportMenu} site=${site} scope=${scope} />
    </div>
    ${hasChips && html`<div class="sb-chips">
      ${zoomed && html`<span class="chip zoom-chip"><${Icon} name="zoom-in" size=${13} class="chip-ico" /><span>Zoomed</span><b>${periodLabel(scope, site)}</b><button aria-label="Reset zoom" title="Back to the previous period" onClick=${resetZoom}><${Icon} name="x" size=${12} /></button></span>`}
      <${FilterChips} scope=${scope} edit=${(f) => setFilter(f)} segs=${segs} />
      <button class="more sb-reset" onClick=${reset}>Reset</button>
    </div>`}
    ${dialog === 'save' && segs && html`<${SaveSegment} site=${site} scope=${scope} segs=${segs} onClose=${() => setDialog(null)} />`}
    ${dialog === 'manage' && segs && html`<${ManageSegments} site=${site} scope=${scope} segs=${segs} onClose=${() => setDialog(null)} />`}
  </div>`;
}
