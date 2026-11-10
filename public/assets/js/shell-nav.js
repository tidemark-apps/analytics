// Shell: Routes of the sidebar and the `g` chords, account tabs, path helpers and the site list.
import { useMemo, useApi, navigate, BASE } from './lib.js';
import { registry } from './extensions.js';
import { organizationsOn } from './org.js';

const NOT_A_SITE = new Set(['', 'sites', 'settings', 'login', 'register', 'forgot-password', 'reset-password', 'share']);
// the first segment of an extension's page ('/support' for '/support/:number?') is not a site either
const isExtensionPage = (seg) => registry.routes.some(([pattern]) => pattern.split('/')[1] === seg);
export const siteFromPath = (path) => { const seg = path.split('/')[1] || ''; return NOT_A_SITE.has(seg) || isExtensionPage(seg) ? null : decodeURIComponent(seg); };

/** Items of the sidebar while a site is open, and the targets of the `g` chords. ONE place to change when a report is added:
 *  - `route`: a path suffix; the item links to `/<domain><route>` ('' is the overview) and is highlighted by the path.
 *  - `scoped`: the link carries the period, comparison and filters in the URL, so moving between reports keeps what you look at.
 *  - `key`: the second key of the `g` chord ('g' then 'p' goes to Pages).
 *  - `manage`: only for owners and admins of the site.
 *  The routes themselves are registered in main.js (see REPORT_ROUTES). */
export const SITE_NAV = [
  { id: 'overview', label: 'Overview', icon: 'chart-column', route: '', key: 'o', scoped: true },
  { id: 'pages', label: 'Pages', icon: 'file-text', route: '/pages', key: 'p', scoped: true },
  { id: 'sources', label: 'Sources', icon: 'compass', route: '/sources', key: 's', scoped: true },
  { id: 'locations', label: 'Locations', icon: 'globe', route: '/locations', key: 'l', scoped: true },
  { id: 'devices', label: 'Devices', icon: 'monitor', route: '/devices', key: 'd', scoped: true },
  { id: 'events', label: 'Events and goals', icon: 'target', route: '/events', key: 'e', scoped: true },
  { id: 'funnels', label: 'Funnels', icon: 'funnel', route: '/funnels', key: 'f', scoped: true },
  { id: 'journeys', label: 'Journeys', icon: 'route', route: '/journeys', key: 'j', scoped: true },
  { id: 'settings', label: 'Settings', icon: 'settings', route: '/settings', key: ',', manage: true },
];
/** Sidebar and chord targets outside a site. */
export const GLOBAL_NAV = [
  { id: 'sites', label: 'Sites', icon: 'layout-dashboard', to: '/sites', key: 's' },
];
/** The tabs of a site's (or rollup's) settings: [key, label]. The sidebar nests them under Settings and the settings page uses the same list. */
export const siteSettingsTabs = (rollup) => (rollup
  ? [['sites', 'Sites'], ['conversions', 'Conversions'], ['access', 'Sharing'], ['data', 'Data']]
  : [['tracking', 'Tracking'], ['conversions', 'Conversions'], ['alerts', 'Alerts'], ['campaigns', 'Campaigns'], ['access', 'Sharing and access'], ['data', 'Data']]);
/** The tab a settings URL means. A few sections moved between tabs; older links and bookmarks still land in the right place. */
export function siteSettingsTab(rollup, tab) {
  const tabs = siteSettingsTabs(rollup);
  const moved = { general: rollup ? 'data' : 'tracking', shields: 'tracking', goals: 'conversions', funnels: 'conversions', visibility: 'access', branding: 'access', people: 'access' };
  return [tab, moved[tab]].find((k) => tabs.some((x) => x[0] === k)) || tabs[0][0];
}
export const ACCOUNT_ICONS = { profile: 'user', security: 'shield-check', keys: 'key', reports: 'mail', teams: 'users', organization: 'shield', users: 'user-plus', updates: 'refresh-cw', billing: 'credit-card' };
/** The tabs of Account settings: [key, label, dot?]. Also drives the sidebar and the palette. */
export function accountTabs(user) {
  const extra = registry.accountTabs.filter((x) => !x.visible || x.visible(user));
  const orgTabs = organizationsOn() ? [['organization', 'Organization'], ['teams', 'Teams']] : [];
  return [['profile', 'Profile'], ['security', 'Security'], ['keys', 'API keys'], ['reports', 'Email reports'], ...orgTabs, ...extra.map((x) => [x.key, x.label, !!(x.dot && x.dot(user))]),
    ...(user.is_admin && !registry.adminUi ? [['users', 'Users'], ...(user.updater_enabled === false ? [] : [['updates', 'Updates', !!user.update]])] : [])];
}

const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
/** Scroll the dashboard to a section; from another page of the site, open the dashboard and let it do the scrolling. */
export const scrollToSection = (id) => { const el = document.getElementById('sec-' + id); if (el) el.scrollIntoView({ behavior: smooth(), block: 'start' }); };
export function jumpToSection(domain, id) {
  if (location.pathname.replace(BASE, '').replace(/\/$/, '') === '/' + domain) scrollToSection(id);
  else { window.__tdmJump = id; navigate('/' + domain); }
}
/** Tell the open dashboard to do something (change the period, toggle the comparison). */
export const command = (detail) => window.dispatchEvent(new CustomEvent('tdm:cmd', { detail }));
export const openPalette = () => window.dispatchEvent(new CustomEvent('tdm:palette'));
export const openShortcuts = () => window.dispatchEvent(new CustomEvent('tdm:shortcuts'));
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? '⌘' : 'Ctrl');

const sortSites = (list) => list.slice().sort((a, b) => (a.rollup !== b.rollup ? (a.rollup ? -1 : 1) : a.domain.localeCompare(b.domain)));
/** The user's sites, fetched once for the shell (top bar, sidebar, palette). */
export function useSites(path, enabled = true) {
  const res = useApi('/sites', null, [path.startsWith('/sites') ? path : ''], { enabled });
  const list = useMemo(() => sortSites((res.data && res.data.data) || []), [res.data]);
  return { list, loading: res.loading && !res.data, other: res.data && res.data.other_sites };
}
