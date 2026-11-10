// Reusable UI building blocks.
import { html, useState, useEffect, useLayoutEffect, useRef, copy, toast, useToasts, Icon, Link, fmt } from './lib.js';

export const Loading = ({ rows = 5 }) => html`<div class="stack sm" aria-busy="true" aria-label="Loading">${Array.from({ length: rows }, (_, i) => html`<div class="skeleton" style=${`height:26px;width:${96 - i * 8}%`}></div>`)}</div>`;
/** A person's photo or an organization's logo, or their initial when there is none. `shape="org"` gives organizations a rounded square. */
export function Avatar({ name, url, size = '', shape = 'user', icon }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [url]);
  const cls = 'avatar' + (size ? ' ' + size : '') + (shape === 'org' ? ' org' : '');
  if (url && !bad) return html`<span class=${cls + ' has-img'} aria-hidden="true"><img src=${url} alt="" onError=${() => setBad(true)} /></span>`;
  return html`<span class=${cls} aria-hidden="true">${icon ? html`<${Icon} name=${icon} size=${14} />` : (name || '?').slice(0, 1).toUpperCase()}</span>`;
}

export const Empty = ({ title = 'Nothing here yet', icon = 'chart-column', children }) => html`<div class="empty fade-in"><div class="ico"><${Icon} name=${icon} size=${20} /></div><b>${title}</b>${children && html`<div class="empty-body">${children}</div>`}</div>`;
export const ErrorBox = ({ error }) => (error ? html`<div class="alert" role="alert"><${Icon} name="info" size=${16} /><div>${error.message}</div></div>` : null);
export const Notice = ({ children, icon = 'info', tone = '' }) => html`<div class=${'notice ' + tone}><${Icon} name=${icon} size=${16} /><div>${children}</div></div>`;
/** Alert / banner: tone is '', 'good', 'warn' or 'danger'; `action` (a button or link) sits at the right; onClose makes it dismissible. */
export const Alert = ({ children, icon = 'info', tone = '', title, onClose, action }) => html`<div class=${'notice ' + tone} role=${tone === 'danger' ? 'alert' : 'status'}><${Icon} name=${icon} size=${16} /><div class="grow">${title && html`<b>${title} </b>`}${children}</div>${action && html`<div class="alert-action">${action}</div>`}${onClose && html`<button class="btn ghost icon sm" aria-label="Dismiss" onClick=${onClose}><${Icon} name="x" size=${14} /></button>`}</div>`;
export const Badge = ({ children, tone = '', dot, title }) => html`<span class=${'badge ' + tone} title=${title}>${dot && html`<span class=${'dot static ' + (tone === 'good' || tone === 'success' ? '' : tone ? tone : 'off')} aria-hidden="true"></span>`}${children}</span>`;
/** The change against the comparison period: a green/red pill with an arrow. Bounce rate is the one metric where lower is better. */
export function Delta({ metric, change, isNew, compact }) {
  if (isNew) return html`<span class=${'delta flat' + (compact ? ' compact' : '')} title="Not in the comparison period">New</span>`;
  if (change === null || change === undefined) return null;
  const flat = Math.abs(change) < 0.05;
  const good = metric === 'bounce_rate' ? change < 0 : change > 0;
  return html`<span class=${'delta ' + (flat ? 'flat' : good ? 'up' : 'down') + (compact ? ' compact' : '')}>${!flat && html`<${Icon} name=${change > 0 ? 'arrow-up' : 'arrow-down'} size=${11} />`}<span class="sr-only">${change > 0 ? 'Up ' : change < 0 ? 'Down ' : ''}</span>${Math.abs(change) >= 1000 ? '999%+' : Math.abs(change).toFixed(change % 1 === 0 || Math.abs(change) >= 100 ? 0 : 1) + '%'}</span>`;
}
/** The full-width banner under the top bar. tone: '' (amber), 'danger', 'info'. Optional `action` button/link and `onClose`. */
export const Banner = ({ children, icon = 'info', tone = '', action, onClose }) => html`<div class=${'banner ' + tone} role=${tone === 'danger' ? 'alert' : 'status'}><span class="banner-in"><${Icon} name=${icon} size=${15} /><span>${children}</span></span>${action}${onClose && html`<button class="btn ghost icon sm" aria-label="Dismiss" onClick=${onClose}><${Icon} name="x" size=${14} /></button>`}</div>`;
export const Kbd = ({ children }) => html`<kbd>${children}</kbd>`;
export const Spinner = () => html`<span class="spinner" role="status" aria-label="Loading"></span>`;
export const Progress = ({ value, label }) => html`<progress max="100" value=${value} aria-label=${label} style="width:100%"></progress>`;
/** A square letter tile standing in for a favicon (no third-party requests); the color is derived from the name. */
export const FavTile = ({ name = '?', rollup, size = '' }) => {
  const [missing, setMissing] = useState(false);
  const hue = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  if (rollup) return html`<span class=${'favtile rollup ' + size} aria-hidden="true"><${Icon} name="layers" size=${size === 'sm' ? 11 : 13} /></span>`;
  // the site's own icon, fetched and kept by the server, covers the letter tile once it has loaded; with no icon the tile stays
  return html`<span class=${'favtile ' + size} style=${`--tile:hsl(${hue} 42% 38%)`} aria-hidden="true">${name.slice(0, 1)}${!missing && html`<img class="fav-img" alt="" loading="lazy" decoding="async" src=${`${window.SD.base}/api/sites/${encodeURIComponent(name)}/favicon`} onLoad=${(e) => e.target.classList.add('loaded')} onError=${() => setMissing(true)} />`}</span>`;
};
/** Tooltip around one control: appears on hover and keyboard focus. */
export const Tooltip = ({ text, kbd, side = '', children }) => html`<span class="tip-wrap">${children}<span class=${'tip ' + side} role="tooltip">${text}${kbd && html`<kbd>${kbd}</kbd>`}</span></span>`;
export const Breadcrumb = ({ items }) => html`<nav class="breadcrumb" aria-label="Breadcrumb">${items.map((it, i) => html`${i > 0 && html`<${Icon} name="chevron-right" size=${14} class="bc-sep" />`}${it.to && i < items.length - 1 ? html`<a data-link href=${window.SD.base + it.to}>${it.label}</a>` : html`<span aria-current=${i === items.length - 1 ? 'page' : undefined}>${it.label}</span>`}`)}</nav>`;
/** Underline tabs. items: [[key, label, count?]]; `panel` ids are optional. */
export function Tabs({ items, value, onChange, label = 'Sections' }) {
  const onKey = (e) => {
    const i = items.findIndex((x) => x[0] === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = items[(next + items.length) % items.length];
    onChange(t[0]);
    setTimeout(() => { const b = e.currentTarget.querySelector('[aria-selected="true"]'); b && b.focus(); }, 0);
  };
  return html`<div class="tabs" role="tablist" aria-label=${label} onKeyDown=${onKey}>${items.map(([k, l, n]) => html`<button role="tab" type="button" aria-selected=${k === value} tabindex=${k === value ? 0 : -1} class=${k === value ? 'on' : ''} onClick=${() => onChange(k)}>${l}${n !== undefined && html`<span class="muted">${n}</span>`}</button>`)}</div>`;
}
/** Segmented control for view toggles: items [[key, label, icon?]]. */
export const Segmented = ({ items, value, onChange, label }) => html`<div class="seg" role="radiogroup" aria-label=${label}>${items.map(([k, l, i]) => html`<button type="button" role="radio" aria-checked=${k === value} aria-label=${i ? l : undefined} title=${i ? l : undefined} class=${k === value ? 'on' : ''} onClick=${() => onChange(k)}>${i && html`<${Icon} name=${i} size=${14} />`}${!i && l}</button>`)}</div>`;

export function PageHead({ title, sub, crumb, children }) {
  return html`<header class="page-head"><div class="grow">${crumb && html`<div class="crumb">${crumb}</div>`}<h1>${title}</h1>${sub && html`<div class="sub">${sub}</div>`}</div>${children && html`<div class="row wrap">${children}</div>`}</header>`;
}

export function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn();
    const k = (e) => e.key === 'Escape' && fn();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [fn]);
}

export function Pop({ label, children, align = 'right', btnClass = 'btn', open: openProp, setOpen: setOpenProp, ariaLabel }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = setOpenProp ?? setOpenState;
  const ref = useRef();
  useClickOutside(ref, () => open && setOpen(false));
  // keep the popover inside the viewport on narrow screens
  useLayoutEffect(() => {
    const el = open && ref.current && ref.current.querySelector('.pop');
    if (!el) return;
    el.style.translate = '0px';
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const dx = r.left < 8 ? 8 - r.left : r.right > vw - 8 ? vw - 8 - r.right : 0;
    if (dx) el.style.translate = dx + 'px';
  }, [open]);
  const trigger = useRef();
  // Esc closes the menu and puts focus back on the button that opened it
  useEffect(() => {
    if (!open) return;
    const esc = (e) => { if (e.key === 'Escape' && ref.current && ref.current.contains(document.activeElement)) { e.stopPropagation(); trigger.current && trigger.current.focus(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const pop = ref.current && ref.current.querySelector('.pop');
    const items = () => [...(pop ? pop.querySelectorAll('.item, [role="menuitem"]') : [])].filter((el) => !el.disabled);
    const key = (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || !pop || !pop.contains(document.activeElement) && document.activeElement !== trigger.current) return;
      if (/input|textarea|select/i.test(document.activeElement.tagName) && !e.altKey) return;
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      const i = list.indexOf(document.activeElement);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[n].focus();
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); };
  }, [open]);
  const toggle = () => setOpen(!open);
  return html`<div class="pop-wrap" ref=${ref}>
    <button ref=${trigger} class=${btnClass} aria-haspopup="true" aria-expanded=${open} aria-label=${ariaLabel} onClick=${toggle}>${label}</button>
    ${open && html`<div class=${'pop ' + (align === 'left' ? 'left' : '')}>${typeof children === 'function' ? children(() => { setOpen(false); trigger.current && trigger.current.focus(); }) : children}</div>`}
  </div>`;
}

/** Traps focus, closes on Escape, restores focus to the trigger on close. */
export function useDialog(onClose) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const root = ref.current;
    const focusables = () => [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
    const first = root.querySelector('[autofocus]') || root.querySelector('input, select, textarea') || focusables()[0];
    first && first.focus();
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prevOverflow; prev && prev.focus && prev.focus(); };
  }, []);
  return ref;
}

/** Dialog. `size` is 'md' (640) or 'wide' (860); the default is 480. `wide` still works. */
export function Modal({ title, onClose, children, footer, wide, size, description }) {
  const ref = useDialog(onClose);
  return html`<div class="overlay" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'modal ' + (wide ? 'wide' : size || '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <div class="modal-h"><div><h2>${title}</h2>${description && html`<p class="muted small" style="margin-top:2px">${description}</p>`}</div><button class="btn ghost icon" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></div>
      <div class="modal-b">${children}</div>
      ${footer && html`<div class="modal-f">${footer}</div>`}
    </div>
  </div>`;
}

/** Right-hand drawer without a frame; kept for existing callers. Prefer Sheet. */
export function Drawer({ onClose, children }) {
  const ref = useDialog(onClose);
  return html`<div><div class="overlay" style="padding:0;z-index:54" onMouseDown=${onClose}></div><aside class="drawer" role="dialog" aria-modal="true" ref=${ref}>${children}</aside></div>`;
}

/** Right-side sheet for detail and edit flows. size: '' (420), 'md' (560) or 'lg' (720). */
export function Sheet({ title, description, onClose, children, footer, size = '' }) {
  const ref = useDialog(onClose);
  return html`<div><div class="overlay" style="padding:0;z-index:54" onMouseDown=${onClose}></div>
    <aside class=${'sheet ' + size} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <div class="sheet-h"><div><h2>${title}</h2>${description && html`<p>${description}</p>`}</div><button class="btn ghost icon" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></div>
      <div class="sheet-b">${children}</div>
      ${footer && html`<div class="sheet-f">${footer}</div>`}
    </aside></div>`;
}

/** Alert dialog. Destructive by default (the confirm button is red); pass destructive=${false} for a plain confirmation. */
export function Confirm({ title, message, confirmLabel = 'Delete', onConfirm, onClose, destructive = true }) {
  const [busy, setBusy] = useState(false);
  return html`<${Modal} title=${title} onClose=${onClose} footer=${html`
    <button class="btn" onClick=${onClose}>Cancel</button>
    <button class=${'btn ' + (destructive ? 'destructive' : 'primary')} disabled=${busy} onClick=${async () => { setBusy(true); try { await onConfirm(); onClose(); } catch (e) { toast(e.message, 'err'); setBusy(false); } }}>${busy ? 'Working…' : confirmLabel}</button>`}>
    <p style="line-height:1.55;color:var(--muted-foreground)">${message}</p>
  <//>`;
}

/** Confirm by typing a phrase (the site's domain, usually) before a destructive action. */
export function TypedConfirm({ title, message, phrase, confirmLabel = 'Delete', onConfirm, onClose, caseInsensitive = true }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  return html`<${Modal} title=${title} onClose=${onClose} footer=${html`
    <button class="btn" onClick=${onClose}>Cancel</button>
    <button class="btn destructive" disabled=${busy || (caseInsensitive ? text.trim().toLowerCase() !== phrase.toLowerCase() : text.trim() !== phrase)} onClick=${async () => { setBusy(true); try { await onConfirm(); onClose(); } catch (e) { toast(e.message, 'err'); setBusy(false); } }}>${busy ? 'Working…' : confirmLabel}</button>`}>
    <div class="stack sm"><p style="line-height:1.55;color:var(--muted-foreground)">${message}</p>
      <label><span>Type <b class="mono" style="color:var(--foreground)">${phrase}</b> to confirm</span><input value=${text} onInput=${(e) => setText(e.target.value)} autocomplete="off" autocapitalize="off" spellcheck="false" aria-label=${'Type ' + phrase + ' to confirm'} /></label></div>
  <//>`;
}

export const Field = ({ label, help, error, children, class: c }) => html`<label class=${c}>${label}${children}${help && html`<span class="help">${help}</span>`}${error && html`<span class="field-error" role="alert">${error}</span>`}</label>`;

export function CodeBlock({ text }) {
  return html`<div class="code"><span class="code-t">${text}</span><button class="btn sm" onClick=${() => copy(text)}><${Icon} name="copy" size=${13} /> Copy</button></div>`;
}

/** Tiny area+line chart for a row of numbers. */
export function Sparkline({ data, height = 36 }) {
  if (!data || !data.length) return null;
  const w = 200, max = Math.max(1, ...data);
  const pts = data.map((d, i) => [(i / Math.max(1, data.length - 1)) * w, height - 3 - (d / max) * (height - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return html`<svg viewBox=${`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height=${height} class="spark" aria-hidden="true">
    <path d=${line + ` L${w} ${height} L0 ${height} Z`} fill="var(--series-1-wash)" /><path d=${line} fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" /></svg>`;
}

/** A link to where a plan is changed. When the host that runs this install sets an upgrade address (TIDEMARK_UPGRADE_URL), it leads there in a new tab; otherwise it stays in the app, at the billing tab if an extension provides one. */
export const UpgradeLink = ({ to = '/settings', class: c, onClick, children }) => window.SD && window.SD.upgradeUrl
  ? html`<a href=${window.SD.upgradeUrl} class=${c} target="_blank" rel="noopener" onClick=${onClick}>${children}</a>`
  : html`<${Link} to=${to} class=${c} onClick=${onClick}>${children}<//>`;

/** The body of a section a plan doesn't include: blurred and out of reach, with a lock and a way to upgrade (Cloud only; self-hosted installs are never locked). */
const ProLock = ({ children, note }) => html`<div class="prolock"><div class="prolock-body" inert aria-hidden="true">${children}</div>
  <div class="prolock-over" role="note"><span class="prolock-ico" aria-hidden="true"><${Icon} name="lock" size=${22} /></span><b>Upgrade to unlock</b>
    <p>To access this feature, <${UpgradeLink} to="/settings/billing">upgrade your plan<//>.${note ? ' ' + note : ''}</p></div></div>`;
/** A setting card: title, description, body and an optional footer (helper text left, Save right). */
export const Section = ({ title, help, children, danger, locked, lockNote, footer }) => html`<section class=${'card setting ' + (danger ? 'danger-zone' : '')}><div class="setting-h"><h2>${title}</h2>${help && html`<p>${help}</p>`}</div>${children && html`<div class="setting-b">${locked ? html`<${ProLock} note=${lockNote}>${children}<//>` : children}</div>`}${footer && !locked && html`<div class="setting-f">${footer}</div>`}</section>`;
export const Card = ({ title, actions, children, pad = true, class: c = '', footer }) => html`<section class=${'card ' + c}>${(title || actions) && html`<div class="card-h"><h3>${title}</h3><div class="row">${actions}</div></div>`}<div class=${pad ? 'card-b' : 'card-flush'}>${children}</div>${footer && html`<div class="card-f">${footer}</div>`}</section>`;

/** The settings pattern: title + description, body, and a footer with helper text on the left and the action on the right. */
export const SettingCard = ({ title, help, children, footer, danger, class: c = '' }) => html`<section class=${'card setting ' + (danger ? 'danger-zone ' : '') + (children ? '' : 'no-body ') + c}>
  <div class="setting-h"><h2>${title}</h2>${help && html`<p>${help}</p>`}</div>
  ${children && html`<div class="setting-b">${children}</div>`}
  ${footer && html`<div class="setting-f">${footer}</div>`}</section>`;

// ----------------------------------------------------------------------------------------- data table helpers
/** Sort state for a table: `sorted(rows, getters)` returns the rows ordered by the active column. */
export function useSort(initial, dir = 'desc') {
  const [state, setState] = useState({ key: initial, dir });
  const toggle = (key) => setState((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const sorted = (rows, get = {}) => {
    const g = get[state.key] || ((r) => r[state.key]);
    return [...rows].sort((a, b) => { const x = g(a), y = g(b); const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? 0) - (y ?? 0); return state.dir === 'desc' ? -c : c; });
  };
  return { ...state, toggle, sorted };
}
/** A sortable column header (<th>): shows the arrow and sets aria-sort. */
export const SortTh = ({ sort, k, children, right }) => html`<th class=${right ? 'right' : ''} aria-sort=${sort.key === k ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}><button type="button" class="sort" onClick=${() => sort.toggle(k)}>${children}${sort.key === k && html`<${Icon} name=${sort.dir === 'desc' ? 'arrow-down' : 'arrow-up'} size=${12} />`}</button></th>`;
/** "1-25 of 312" with previous / next. `page` is ZERO-based (0 is the first page); renders nothing when everything fits on one page. */
export const Pagination = ({ page, size, total, onPage }) => {
  if (total <= size) return null;
  const from = total ? page * size + 1 : 0, to = Math.min(total, (page + 1) * size);
  return html`<div class="table-foot"><span class="num">${from}-${to} of ${fmt(total)}</span><div class="row"><button class="btn sm" disabled=${page === 0} onClick=${() => onPage(page - 1)}>Previous</button><button class="btn sm" disabled=${to >= total} onClick=${() => onPage(page + 1)}>Next</button></div></div>`;
};

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value]);
  return v;
}

/** Switch row: a labeled toggle with help text. */
export const Toggle = ({ label, help, checked, onChange, disabled }) => html`<label class="toggle"><input type="checkbox" role="switch" checked=${checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} /><span class="track" aria-hidden="true"></span><span class="grow"><b>${label}</b>${help && html`<span class="help">${help}</span>`}</span></label>`;

/** The toast stack (bottom right): icon, title, optional description and action. Mounted once by the app. */
export function Toaster() {
  const toasts = useToasts();
  return html`<div class="toasts" aria-live="polite">${toasts.map((t) => html`<div class=${'toast ' + t.kind} role="status"><${Icon} name=${t.kind === 'err' ? 'circle-alert' : 'circle-check'} size=${16} /><div class="toast-t">${t.message}${t.description && html`<span class="toast-d">${t.description}</span>`}</div>${t.action && html`<button class="btn sm toast-a" onClick=${t.action.onClick}>${t.action.label}</button>`}</div>`)}</div>`;
}
