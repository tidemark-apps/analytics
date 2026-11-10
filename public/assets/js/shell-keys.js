// Shell: The ⌘K command palette and the keyboard shortcuts.
import { html, useState, useEffect, useMemo, useRef, navigate, Icon, PERIODS, UserCtx, useContext, setTheme, scopeQuery } from './lib.js';
import { Sheet } from './ui.js';
import { ACCOUNT_ICONS, SITE_NAV, accountTabs, command, modKey, openShortcuts, siteFromPath } from './shell-nav.js';

export function CommandPalette({ path, sites }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef();
  const domain = siteFromPath(path);
  const { user } = useContext(UserCtx) || {};
  const list = sites ? sites.list : [];
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const show = () => setOpen(true);
    document.addEventListener('keydown', key);
    window.addEventListener('tdm:palette', show);
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('tdm:palette', show); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => input.current && input.current.focus(), 0); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    return () => { prev && prev.focus && prev.isConnected && prev.focus(); };
  }, [open]);
  const items = useMemo(() => {
    const go = (to) => () => navigate(to);
    const out = [];
    if (domain) {
      PERIODS.filter((p) => p[0] !== 'custom').forEach(([k, l, key]) => out.push({ group: 'Date range', icon: 'calendar', label: l, hint: key, run: () => command({ type: 'period', key: k }) }));
      out.push({ group: 'Date range', icon: 'calendar', label: 'Custom range…', hint: 'U', run: () => command({ type: 'period', key: 'custom' }) });
      out.push({ group: 'Date range', icon: 'chevron-left', label: 'Previous period', hint: '[', run: () => command({ type: 'step', dir: -1 }) });
      out.push({ group: 'Date range', icon: 'chevron-right', label: 'Next period', hint: ']', run: () => command({ type: 'step', dir: 1 }) });
      out.push({ group: 'View', icon: 'git-compare', label: 'Toggle comparison with the previous period', hint: 'C', run: () => command({ type: 'compare' }) });
      out.push({ group: 'View', icon: 'plus', label: 'Add a filter…', hint: '', run: () => command({ type: 'filter' }) });
      out.push({ group: 'View', icon: 'rotate-ccw', label: 'Reset filters and zoom', run: () => command({ type: 'reset' }) });
      out.push({ group: 'View', icon: 'download', label: 'Export this view as CSV', run: () => command({ type: 'export' }) });
      SITE_NAV.filter((i) => !i.manage).forEach((i) => out.push({ group: 'This site', icon: i.icon, label: i.label, hint: 'g ' + i.key, run: go('/' + domain + i.route + scopeQuery()) }));
      out.push({ group: 'This site', icon: 'settings', label: 'Site settings', hint: 'g ,', run: go(`/${domain}/settings`) });
    }
    list.forEach((s) => out.push({ group: 'Sites', icon: s.rollup ? 'layers' : 'globe', label: s.domain, hint: s.rollup ? 'Rollup' : '', run: go('/' + s.domain) }));
    out.push({ group: 'Go to', icon: 'layout-dashboard', label: 'All sites', hint: 'g a', run: go('/sites') }, { group: 'Go to', icon: 'plus', label: 'Add a site', run: go('/sites/new') });
    if (user) accountTabs(user).forEach(([k, l]) => out.push({ group: 'Settings', icon: ACCOUNT_ICONS[k] || 'settings', label: l, run: go(k === 'profile' ? '/settings' : '/settings/' + k) }));
    out.push({ group: 'Preferences', icon: 'sun', label: 'Theme: light', run: () => setTheme('light') }, { group: 'Preferences', icon: 'moon', label: 'Theme: dark', run: () => setTheme('dark') }, { group: 'Preferences', icon: 'monitor', label: 'Theme: match system', run: () => setTheme('system') },
      { group: 'Preferences', icon: 'keyboard', label: 'Keyboard shortcuts', hint: '?', run: openShortcuts }, { group: 'Preferences', icon: 'book-open', label: 'Documentation', run: () => window.open('https://account.hellotidemark.com/kb/tidemark-analytics/', '_blank', 'noopener') });
    return out;
  }, [domain, list, user && user.is_admin]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    // an empty search shows a short, useful start; typing searches everything
    const base = t ? items.filter((i) => i.label.toLowerCase().includes(t) || (i.group + ' ' + i.label).toLowerCase().includes(t)) : items.filter((i) => !['Date range', 'Preferences', 'Account'].includes(i.group) || (i.group === 'Date range' && i.label === 'Today'));
    return base.slice(0, t ? 20 : 14);
  }, [items, q]);
  useEffect(() => setSel(0), [q]);
  if (!open) return null;
  const run = (i) => { setOpen(false); i && setTimeout(i.run, 0); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(shown.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); }
    else if (e.key === 'Tab') e.preventDefault();
  };
  const groups = [];
  shown.forEach((i, n) => { let g = groups.find((x) => x[0] === i.group); if (!g) groups.push((g = [i.group, []])); g[1].push([i, n]); });
  return html`<div class="overlay palette-wrap" onMouseDown=${(e) => e.target === e.currentTarget && setOpen(false)}>
    <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="palette-in"><${Icon} name="search" size=${16} /><input ref=${input} value=${q} placeholder="Type a command or search…" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant=${shown[sel] ? 'pal-' + sel : undefined} aria-label="Search commands" onInput=${(e) => setQ(e.target.value)} onKeyDown=${onKey} /><kbd>esc</kbd></div>
      <div class="palette-list" id="palette-list" role="listbox" aria-label="Results">${shown.length === 0 ? html`<div class="palette-empty muted">No results for “${q}”.</div>` : groups.map(([label, rows]) => html`<div role="group" aria-label=${label}><div class="grp" aria-hidden="true">${label}</div>${rows.map(([i, n]) => html`<button id=${'pal-' + n} tabindex="-1" role="option" aria-selected=${n === sel} class=${'palette-item ' + (n === sel ? 'on' : '')} onMouseMove=${() => setSel(n)} onClick=${() => run(i)}><${Icon} name=${i.icon} size=${15} /><span>${i.label}</span>${i.hint && html`<em>${i.hint}</em>`}</button>`)}</div>`)}</div>
      <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span><kbd>esc</kbd> Close</span></div>
    </div></div>`;
}

const typingIn = (e) => {
  const t = (e.composedPath && e.composedPath()[0]) || e.target;
  const is = (n) => n && (/input|textarea|select/i.test(n.tagName || '') || n.isContentEditable);
  return is(t) || is(e.target) || /-/.test((e.target && e.target.tagName) || '');
};

/** Global keys: `?` opens the shortcut list, `g` then a letter jumps (sections of the open site, or the sites list). */
export function ShellKeys({ path }) {
  const [open, setOpen] = useState(false);
  const domain = siteFromPath(path);
  const state = useRef({});
  state.current = { domain, path };
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('tdm:shortcuts', show);
    let armed = 0;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e)) return;
      if (e.key === '?') { if (!document.querySelector('.overlay')) { e.preventDefault(); setOpen(true); } return; }
      if (document.querySelector('.overlay') || document.querySelector('.sheet')) return;
      const now = Date.now();
      if (armed && now - armed < 1200) {
        armed = 0;
        const k = e.key.toLowerCase();
        const { domain: d } = state.current;
        const site = d && SITE_NAV.find((i) => i.key === k);
        if (site) { e.preventDefault(); e.stopImmediatePropagation(); navigate('/' + d + site.route + (site.scoped ? scopeQuery() : '')); }
        else if (k === 'a') { e.preventDefault(); e.stopImmediatePropagation(); navigate('/sites'); }
        return;
      }
      armed = e.key === 'g' ? now : 0;
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('tdm:shortcuts', show); };
  }, []);
  if (!open) return null;
  const Row = ({ label, keys }) => html`<div class="sc-row"><span>${label}</span><span class="keys">${keys.map((k) => html`<kbd>${k}</kbd>`)}</span></div>`;
  return html`<${Sheet} title="Keyboard shortcuts" description="Shortcuts are off while you type in a field." onClose=${() => setOpen(false)}>
    <div class="shortcuts">
      <h3>General</h3>
      <${Row} label="Command palette" keys=${[modKey(), 'K']} /><${Row} label="This list" keys=${['?']} /><${Row} label="Close a menu or dialog" keys=${['Esc']} />
      <h3>Go to (press G, then)</h3>
      <${Row} label="All sites" keys=${['g', 'a']} />
      ${SITE_NAV.map((i) => html`<${Row} label=${i.label} keys=${['g', i.key]} />`)}
      <h3>Period and comparison</h3>
      <${Row} label="Previous period" keys=${['[']} /><${Row} label="Next period" keys=${[']']} />
      <${Row} label="Today" keys=${['T']} /><${Row} label="Turn comparison on or off" keys=${['C']} />
      ${PERIODS.filter((p) => p[2] && p[0] !== 'day').map(([, l, k]) => html`<${Row} label=${l} keys=${[k]} />`)}
      <${Row} label="Previous / next day, month or year" keys=${['←', '→']} />
      <h3>In reports</h3>
      <${Row} label="Search the table" keys=${['/']} />

    </div>
  <//>`;
}
