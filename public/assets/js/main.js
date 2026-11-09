import { html, render, useState, useEffect, useRef, useBrand, api, navigate, leaveSignIn, useLocation, matchRoute, Link, Icon, toggleTheme, UserCtx } from './lib.js';
import { Login, Register, ForgotPassword, ResetPassword, Invite } from './pages/auth.js';
import { Dashboard } from './dashboard.js';
import { reportRoute, REPORTS } from './report-page.js';
import { SitesPage, NewSite, NewRollup, Installation } from './sites.js';
import { SiteSettings, AccountSettings } from './settings.js';
import { Logo, Lockup } from './logo.js';
import { registry, loadExtensions } from './extensions.js';
import { Sidebar, CommandPalette, AppBar, ShellKeys, useSites, useSidebarState } from './shell.js';
import { Toaster, Empty } from './ui.js';

const head = [
  ['/login', Login],
  ['/register', Register],
  ['/forgot-password', ForgotPassword],
  ['/reset-password', ResetPassword],
  ['/invite', Invite],
  ['/sites', SitesPage],
  ['/sites/new', NewSite],
  ['/sites/rollup', NewRollup],
  ['/settings/:tab?', AccountSettings],
  ['/share/:domain', (p) => html`<${Dashboard} ...${p} shared />`],
  ...Object.keys(REPORTS).map((r) => [`/share/:domain/${r}`, reportRoute(r, true)]),
];
// the full report pages: /:domain/pages ... They sit before the "/:domain" catch-all; a site's domain always has a dot or is never one of these words after it
const REPORT_ROUTES = Object.keys(REPORTS).map((r) => [`/:domain/${r}`, reportRoute(r)]);
const tail = [
  ['/:domain/installation', Installation],
  ['/:domain/settings/:tab?', SiteSettings],
  ...REPORT_ROUTES,
  ['/:domain', Dashboard],
];
// extension pages sit between the fixed pages and the "/{domain}" catch-all
const allRoutes = () => [...head, ...registry.routes, ...tail];
const RESERVED = new Set(['', 'api', 'js', 'assets', 'install', 'up', 'admin']);

function PublicFooter() {
  return html`<footer class="pubfoot"><a href=${window.SD.brandUrl || 'https://tidemarkanalytics.com'} target="_blank" rel="noopener"><span>Analytics by</span><${Lockup} size=${15} /></a></footer>`;
}

const focusMain = (e) => { if (e) e.preventDefault(); const t = document.querySelector('main'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); } };
const SkipLink = () => html`<a class="skip" href="#main" onClick=${focusMain}>Skip to content</a>`;

/** The minimal bar for shared and public dashboards (the signed-in shell uses AppBar). */
function PublicBar({ shared }) {
  const brand = useBrand();
  const custom = brand && (brand.logo || brand.name);
  return html`<header class="topbar"><div class="topbar-in">
    ${custom ? html`<span class="brand custom">${brand.logo && html`<img class="brand-logo" src=${brand.logo} alt=${brand.name || ''} />`}${brand.name && !(brand.hide_name && brand.logo) && html`<span class="brand-name">${brand.name}</span>`}</span>`
      : html`<${Link} to="/login" class="brand" aria-label="Tidemark Analytics home"><${Lockup} size=${24} /><//>`}
    ${shared && html`<span class="badge outline">Shared view</span>`}
    <span class="grow"></span>
    <button class="btn ghost icon" onClick=${toggleTheme} aria-label="Toggle light and dark theme" title="Toggle theme"><${Icon} name="sun" size=${16} class="theme-sun" /><${Icon} name="moon" size=${16} class="theme-moon" /></button>
    ${!shared && html`<${Link} to="/login" class="btn sm">Sign in<//>`}
  </div></header>`;
}

function VerifyBanner({ user }) {
  const [sent, setSent] = useState(false);
  if (!user.verification_required || user.email_verified) return null;
  return html`<div class="banner" role="status"><${Icon} name="info" size=${15} /><span>Please confirm your email address (${user.email}) to add sites. ${sent ? 'We sent you a new link.' : ''}</span>
    ${!sent && html`<button class="btn sm" onClick=${async () => { await api('/auth/verification-notification', { method: 'POST' }); setSent(true); }}>Resend email</button>`}</div>`;
}

function App() {
  const { path } = useLocation();
  const [user, setUser] = useState(undefined);
  const isAuth = ['/login', '/register', '/forgot-password', '/reset-password', '/invite'].includes(path);
  const isShare = path.startsWith('/share/');
  const side = useSidebarState(path);
  const sites = useSites(path, !!user && !isShare);
  const announce = useRef();
  const first = useRef(true);

  useEffect(() => {
    if (isShare) { setUser(null); return; }
    api('/me').then((r) => { window.__userTz = r.user.timezone && r.user.timezone !== 'UTC' ? r.user.timezone : undefined; window.__cfg = r.config; setUser(r.user); }).catch(() => setUser(null));
  }, [isAuth, isShare]);

  const seg = path.split('/')[1] || '';
  const m = RESERVED.has(seg) ? null : matchRoute(allRoutes(), path);
  const publicRoute = isShare || (m && m.component.public);
  useEffect(() => { if (user === null && !isAuth && !publicRoute) navigate('/login', { replace: true }); }, [user, path]);
  useEffect(() => { if (user && isAuth && path !== '/invite') leaveSignIn(); }, [user, path]);
  useEffect(() => { if (path === '/' ) navigate(user ? '/sites' : '/login', { replace: true }); }, [path, user]);
  // after a page change: move focus to the page and tell screen readers where they are
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = setTimeout(() => {
      const t = document.querySelector('main');
      if (t) { t.id ||= 'main'; t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
      if (announce.current) announce.current.textContent = document.title;
    }, 350);
    return () => clearTimeout(id);
  }, [path]);

  const Page = m && m.component;
  // keyed so Preact never reuses this node for another unkeyed <div> (e.g. .app) when the tree changes shape after sign-in;
  // its text is set by hand below, and a reused node would keep it and show the page title above the navbar
  const announcer = html`<div key="announcer" class="sr-only" role="status" aria-live="polite" ref=${announce}></div>`;
  if (isAuth) return html`<${UserCtx.Provider} value=${{ user, setUser }}>${Page ? html`<${Page} setUser=${setUser} />` : null}<${Toaster} />${announcer}<//>`;
  if (user === undefined) return html`<div style="display:grid;place-items:center;height:100vh"><${Logo} size=${40} /></div>`;
  if (user === null && !publicRoute) return null;
  const shell = !!user && !isShare;
  const notFound = html`<main class="main"><${Empty} title="Page not found" icon="search"><p>The page you're looking for doesn't exist.</p><${Link} to="/sites" class="btn">Your sites<//><//></main>`;
  return html`<${UserCtx.Provider} value=${{ user, setUser }}>
    <div class=${'app' + (shell ? ' has-side' : '') + (shell && side.collapsed ? ' side-collapsed' : '') + (shell && side.open ? ' side-open' : '')}>
      <${SkipLink} />
      ${shell ? html`<${AppBar} user=${user} path=${path} sites=${sites} side=${side} />` : html`<${PublicBar} shared=${isShare} />`}
      <div class="app-body">
        ${shell && html`<${Sidebar} user=${user} path=${path} sites=${sites} side=${side} />`}
        <div class="app-main">
          ${user && html`<${VerifyBanner} user=${user} />`}
          ${user && registry.banners.map((B) => html`<${B} user=${user} />`)}
          ${Page ? html`<${Page} ...${m.params} />` : notFound}
          ${publicRoute && !user && html`<${PublicFooter} />`}
        </div>
      </div>
    </div>
    ${shell && html`<${CommandPalette} path=${path} sites=${sites} />`}
    ${shell && html`<${ShellKeys} path=${path} />`}
    <${Toaster} />${announcer}<//>`;
}

loadExtensions(window.SD.extensions || []).finally(() => render(html`<${App} />`, document.getElementById('root')));
