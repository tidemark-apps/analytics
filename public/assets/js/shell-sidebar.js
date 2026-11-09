// Shell: The context-aware sidebar.
import { html, Link, Icon, BASE, scopeQuery } from './lib.js';
import { FavTile } from './ui.js';
import { useScope } from './org.js';
import { registry, badgeOf, useBadgeCounts, useBadgePolling } from './extensions.js';
import { ACCOUNT_ICONS, SITE_NAV, accountTabs, siteFromPath, siteSettingsTabs, siteSettingsTab } from './shell-nav.js';
import { BadgeCount, OrgSwitcher, LivePill } from './shell-bar.js';

const SideLink = ({ to, icon, label, on, children, ...rest }) => html`<${Link} to=${to} class=${'side-link ' + (on ? 'on' : '')} title=${label} aria-current=${on ? 'page' : undefined} ...${rest}><${Icon} name=${icon} size=${16} /><span>${label}</span>${children}<//>`;
/** A menu entry's count in the sidebar: a pill, and a dot when the sidebar is collapsed. */
const SideBadge = ({ m }) => { const n = badgeOf(m); return n > 0 && html`<${BadgeCount} m=${m} /><span class="notif side-dot" aria-hidden="true"></span>`; };
const SideExt = ({ href, icon, label, external = true, children }) => html`<a class="side-link" title=${label} href=${href} target=${external ? '_blank' : null} rel=${external ? 'noopener' : null}><${Icon} name=${icon} size=${16} /><span>${label}</span>${children}${external && html`<${Icon} name="external-link" size=${12} class="side-ext" />`}</a>`;

export function Sidebar({ user, path, sites, side }) {
  useBadgePolling(path);
  useBadgeCounts();
  const domain = siteFromPath(path);
  const scope = useScope(user);
  const all = sites ? sites.list : [];
  const current = domain && all.find((s) => s.domain === domain);
  // the counts are for the organization chosen in the switcher, like the Sites page
  const mineIds = (user.organizations || []).map((o) => o.id);
  const list = all.filter((s) => (scope.shared ? !mineIds.includes(s.organization_id) && !s.rollup : s.organization_id === scope.id));
  const canManage = !current || current.role === 'owner' || current.role === 'admin';
  const hasRollups = list.some((s) => s.rollup);
  const tabs = accountTabs(user);
  const onAccount = path === '/settings' || path.startsWith('/settings/');
  const accountTab = path === '/settings' ? 'profile' : path.split('/')[2];
  const tabPath = (k) => (k === 'profile' ? '/settings' : '/settings/' + k);
  const accountOn = (k) => onAccount && (accountTab === k || (k === 'security' && accountTab === 'preferences') || (k === 'profile' && accountTab === 'preferences'));
  const itemOn = (i) => (i.route === '' ? path === '/' + domain : path.startsWith('/' + domain + i.route));
  const body = domain
    ? html`<${Link} to="/sites" class="side-back" title="All sites"><${Icon} name="chevron-left" size=${15} /><span>All sites</span><//>
      <div class="side-site-head"><${FavTile} name=${domain} rollup=${current && current.rollup} /><b>${domain}</b></div>
      ${SITE_NAV.filter((i) => !i.manage || canManage).map((i) => {
        const nested = i.id === 'settings' && itemOn(i);
        const link = html`<${SideLink} to=${'/' + domain + i.route + (i.scoped ? scopeQuery() : '')} icon=${i.icon} label=${i.label} on=${itemOn(i) && !nested} data-open=${nested ? '' : undefined} />`;
        if (!nested) return link;
        const rollup = !!(current && current.rollup);
        const active = siteSettingsTab(rollup, path.split('/')[3]);
        const tabs = siteSettingsTabs(rollup);
        return html`${link}<div class="side-sub" role="group" aria-label="Settings sections">${tabs.map(([k, l]) => html`<${SideLink} to=${'/' + domain + '/settings' + (k === tabs[0][0] ? '' : '/' + k)} icon="" label=${l} on=${active === k} />`)}</div>`;
      })}`
    : html`<div class="side-grp">Workspace</div>
      <${SideLink} to="/sites" icon="layout-dashboard" label="Sites" on=${path === '/sites' || path === '/sites/new' || path === '/sites/rollup'}>${list.some((s) => !s.rollup) && html`<em class="side-count">${list.filter((s) => !s.rollup).length}</em>`}<//>
      ${hasRollups && html`<${SideLink} to="/sites?kind=rollups" icon="layers" label="Rollups" on=${false}><em class="side-count">${list.filter((s) => s.rollup).length}</em><//>`}
      <div class="side-grp">Settings</div>
      ${tabs.map(([k, l, dot]) => html`${k === 'organization' && html`<div class="side-grp">Organization</div>`}<${SideLink} to=${tabPath(k)} icon=${ACCOUNT_ICONS[k] || 'settings'} label=${l} on=${accountOn(k)}>${dot && html`<span class="notif inline" aria-hidden="true"></span><span class="sr-only"> (update available)</span>`}<//>`)}
      ${user.is_admin && registry.adminUi && html`<a class="side-link" title=${registry.adminUi.label} href=${BASE + registry.adminUi.href}><${Icon} name="shield-check" size=${16} /><span>${registry.adminUi.label}</span><${Icon} name="chevron-right" size=${13} class="side-ext" /></a>`}
      <div class="side-grp">Resources</div>
      <${SideExt} href="https://hellotidemark.com/analytics/docs/" icon="book-open" label="Documentation" />
      ${registry.menuItems.filter((m) => !m.visible || m.visible(user)).map((m) => (m.onClick
        ? html`<button class="side-link" title=${m.label} onClick=${m.onClick}><${Icon} name=${m.icon || 'life-buoy'} size=${16} /><span>${m.label}</span><${SideBadge} m=${m} /></button>`
        : html`<${SideExt} href=${m.href} icon=${m.icon || 'external-link'} label=${m.label} external=${!!m.external}><${SideBadge} m=${m} /><//>`))}
      <${SideExt} href="https://community.tidemarkanalytics.com" icon="users" label="Community" />`;
  return html`<aside class="side" id="app-side" aria-label="Main">
    <nav class="side-scroll" aria-label=${domain ? 'Site' : 'Workspace'}>
      <div class="side-ctx"><${OrgSwitcher} user=${user} />${domain && html`<${LivePill} domain=${domain} />`}</div>
      ${body}</nav>
    <div class="side-foot"><button class="side-collapse" onClick=${side.toggleCollapsed} aria-pressed=${side.collapsed} aria-label=${side.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><${Icon} name="panel-left" size=${16} /><span>Collapse</span></button></div>
  </aside><div class="side-scrim" onClick=${() => side.setOpen(false)} aria-hidden="true"></div>`;
}
