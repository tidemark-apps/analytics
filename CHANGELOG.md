# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Site settings → Data → Delete by filter: the confirmation window now closes after the visits are deleted, instead of staying open and ignoring the close button.

## [0.38.0] - 2026-11-04

### Added
- The install snippet in the dashboard has an "Install on" menu: HTML, WordPress, Shopify, Next.js, Nuxt, Astro, SvelteKit and Laravel. Each shows the file to open and the code to paste for your site, and WordPress links to the Tidemark Analytics plugin on WordPress.org. Tidemark remembers your choice.

### Changed
- A site whose visits are all from today no longer looks empty in "Last 7/28/30/91 days": the overview explains that those periods end yesterday and offers a button to show today.

### Fixed
- The word "Tidemark" no longer shows up above the top bar now and then after signing in.

## [0.37.3] - 2026-11-01

### Changed
- The Community link in the app now opens the new community forum at community.tidemarkanalytics.com instead of Discord.

## [0.37.2] - 2026-11-01

### Added
- The sign-in and sign-up pages return you to the page named in `?next=` after you sign in, as long as it is a path on the same address. A link from another service can send people through sign-in and bring them back.

## [0.37.1] - 2026-10-31

### Fixed
- A checkbox on the sign-in and sign-up pages, such as an extension's opt-in, is no longer stretched tall.

## [0.37.0] - 2026-10-31

### Added
- For extensions: `api.registerSignupField(component)` adds a field to the sign-up form; what it sets is sent with the sign-up request.

## [0.36.2] - 2026-10-30

### Changed
- An address that is not a site or rollup, for example a mistyped page, now answers with a 404 status instead of 200. The page looks the same.

## [0.36.1] - 2026-10-29

### Added
- `TIDEMARK_RESERVED_NAMES` (comma-separated) lists extra first path segments that cannot be used as a site domain or rollup name and are never shown as a dashboard, for example the pages of a website served on the same address. Empty by default.

## [0.36.0] - 2026-10-29

### Added
- **Delete by filter** in Site settings → Data. Choose conditions (a page, country, source, campaign, browser, event or event property, and an optional date range), preview how many visits and events match, then delete them after typing the site's domain. A matching visit goes whole, with everything recorded during it, so reports stay consistent; imported history is not touched. Owners and admins can use it, and each deletion is logged with who ran it. New endpoints: `POST /api/sites/{site}/data/preview`, `POST /api/sites/{site}/data/delete` and `GET /api/sites/{site}/data/deletions`.
- **Campaign links** in Site settings → Campaigns. A link builder adds UTM values to any page of your site so visits from a campaign show up under Sources and Campaigns, and can turn the result into a **short link** (`/l/abc`) that counts a click and forwards, or a **tracking pixel** (`/p/abc.gif`) for newsletters that counts a view. Each keeps only a daily total (no cookies, no addresses), and opens are approximate because mail apps may preload or block images. A short link can only point at a page on your own site. On Cloud, creating campaign links is part of Pro; links that already exist keep forwarding. For extensions: `AllowsCampaignLinks`, an optional companion to `Entitlements`. New endpoints: `GET`/`POST /api/sites/{site}/campaign-links` and `PATCH`/`DELETE /api/sites/{site}/campaign-links/{id}`.
- Two-factor sign-in has more ways in. Besides an authenticator app you can turn on **email codes** (a one-time code sent to your account address, needs outgoing email) and **passkeys** (fingerprint, face, screen lock or a security key; any number per account). At sign-in the page offers whichever methods you have set up.
- **Recovery codes.** Turning on the first method gives you ten one-time codes to use if you lose your phone or key, shown once. You can make a new set (which replaces the old one) from Settings → Security.
- Setting up an authenticator app now shows a **QR code** to scan, with the key and an "Open in an authenticator app" button as fallbacks.
- Settings → Security lists each method with its status; removing one asks for your password. The `two_factor` field in `/api/me` is on when any method is. New endpoints: `GET /api/me/two-factor`, `/api/me/two-factor/email`, `/api/me/two-factor/recovery-codes`, `/api/me/passkeys` and `/api/auth/two-factor/{email,passkey}`; `POST /api/auth/login` takes a `method` (`totp`, `email`, `passkey` or `recovery`).

### Changed
- A site's settings sections (Tracking, Conversions, Alerts, Campaigns, Sharing and access, Data) now sit under **Settings** in the sidebar instead of a second list on the page. On phones, and with the sidebar collapsed, the list stays at the top of the page.
- The top bar is lighter on phones: the menu, the site or page you are on, Find and your account. The organization switcher and the live visitor count moved to the top of the menu.

### Fixed
- Phone menu: the organization dropdown opens in place instead of being cut off, and a long menu scrolls instead of squashing its headings.
- Report rows, the Journeys toggle and the footer links on shared dashboards are easier to tap on phones. A few corner radii now follow the design scale, and avatars are easier to read in dark mode.

## [0.35.2] - 2026-10-29

### Fixed
- Phone layout. Controls follow one touch scale below 720px wide (and on touch screens): buttons, inputs and selects are 44px, small buttons and the top bar 40px, menu rows 44px, so mixed rows line up and dropdown options are easy to hit. The top bar drops the logo on phones, shows only the organization's icon on a site page so the site name fits, and opens its switchers across the full width. People and team rows with controls wrap them under the name, and the add-person form stacks. Desktop layouts are unchanged.
- The rollup form says "All the sites in this organization" instead of "All the sites I own".

## [0.35.1] - 2026-10-28

### Changed
- Rollups belong to an organization instead of travelling with a person. A rollup adds up the sites of the organization it is made in (choose the organization in the switcher first), is owned by that organization's owner like its sites, and can be seen and changed by the owner and admins (still never shared with teams). Existing rollups move into their owner's Personal organization. A rollup can't move to another organization; deleting an organization deletes its rollups, and transferring it moves them. For extensions: `AllowsRollupsIn`, an optional companion to `AllowsRollups` that decides per organization.

### Fixed
- The Sites and Rollups counts in the sidebar now count only the organization chosen in the switcher, not every site you can open.

## [0.35.0] - 2026-10-28

### Added
- Events now remember whether they were an interaction (`events.interactive`, false for events sent with `i: 0` such as scroll depth), and the recording check an extension implements (`Entitlements::allowsRecording`) is told. A hosted service can use it to leave measurements out of the events it meters.
- For extensions: the dashboard extension API now has `org`, the organization chosen in the top-bar switcher (`org.useScope(user)`), so a package's pages can follow it, and `registerAfterCreateOrganization` to choose where someone lands right after creating an organization (a hosted service can send them to choose a plan).
- For extensions: `ScopesToOrganizations`, an optional companion to `Entitlements`, so a package that gives each organization its own plan can judge adding a site, and moving one, against the organization it goes into, and show warnings in the move preview. The collector now also tells `allowsRecording` the site's `organization_id`.
- Organizations. Everyone has a Personal organization, created with their sign-in: it holds the sites they add by default, is just theirs (no admins, no invitations, no teams) and can't be renamed, transferred or deleted. Anyone can create more organizations from the switcher in the top bar (Create organization, up to `TIDEMARK_ORGANIZATION_LIMIT`, default 10) and the Sites page, Settings → Organization and Settings → Teams follow the one you pick; sites other people share with you one by one are under "Shared with me". An organization has one owner and any number of admins: admins can see and change every site in it (not the owner's private rollups), add and delete sites, share sites with its teams and manage those teams. Billing, the organization itself, deletion (only once it has no sites) and who else is an admin stay with the owner, who can also hand the organization to one of its admins: the admin accepts within 72 hours and the previous owner stays on as an admin. Admins can leave. Someone without an account gets the 72-hour e-mail invitation (`TIDEMARK_INVITES`), and the site's People list shows organization admins. When you update, everyone gets a Personal organization and the sites they own move into it. Teams belong to an organization.
- Profile photos and organization logos (Settings → Profile, Settings → Organization), so organizations and people are easy to tell apart in the switcher, the lists of people and the top bar. Your Personal organization shows your photo. Pictures are cropped to a square and shrunk in the browser before upload, stored in the database (PNG, JPEG or WebP only, up to 512 KB and 1024 px, checked by their content) and shown to signed-in people.
- Move a site to another organization (Site settings → Sharing and access). A preview lists who gains and loses access first. You need to be an owner or admin of both organizations, and unless both have the same owner only the owner of the organization it is in can move it out, so an admin can't take a site out of an owner's organization into one with another owner. Statistics, goals, shared links, alerts and the people added to the site directly move with it; access that came from the old organization (its admins, and the teams it was shared with, since teams belong to an organization) does not. When the owner changes the site counts against the new owner's plan, and their site limit applies. Rollups can't be moved.
- Teams (Account settings → Teams): group people once, then share a site with the whole team from the site's Sharing and access settings, choosing Viewer or Admin for that team on that site. A person's role on a site is the strongest of their direct role and their teams' roles, and removing someone from a team or deleting the team takes back only the access it gave. Only the site's owner shares it with their own teams. Adding someone with no account to a team sends the same 72-hour e-mail invitation (when `TIDEMARK_INVITES` is on); people with an account are added at once and told by e-mail. Reports, the site list and MCP follow team access.
- E-mail invitations (opt-in with `TIDEMARK_INVITES=true`, needs working mail settings): adding someone without an account under a site's People now sends them an invitation instead of asking you to contact an administrator. They set a name and password from the link, which works once and expires after 72 hours (`TIDEMARK_INVITE_HOURS`). Nothing is created for them until they accept, pending invitations can be resent or cancelled, and people who already have an account are added straight away and told by e-mail.
- Scroll depth and time on page: an opt-in `engagement` script variant (Site settings → Tracking) that sends one non-interactive `Engagement` event per page view with how far the visitor scrolled (`depth`: 0, 25, 50, 75, 100) and how long they were active (`time`, in five bands). It doesn't affect bounce rate or visit duration, repeats for the same page view replace the earlier one, and the properties work in goals, filters and funnels. Numbers only: no element, text or position is captured.
- The Events API accepts `i: 0` (or Plausible's `interactive: false`) for an event that is not an interaction: it is stored, but doesn't count against a bounce and never starts a visit.

### Changed
- Buttons, inputs and selects that sit side by side are now the same height everywhere: the header search box (32px beside 36px icon buttons), the chart's Note and Table buttons beside the Daily/Weekly toggle, and the team sharing row. Form rows (`.goal-add-row`) keep their controls at 36px whatever size class they carry.
- The README shows the current dashboard, and has a section for people who would rather not host Tidemark themselves, pointing to Tidemark Cloud. The notes on how the hosted version is built are gone from it.

## [0.34.0] - 2026-10-26

### Added
- Extensions can place a menu item in the Help (?) menu instead of the account menu (`help: true`), and show a count beside it (`badge`, with an optional `badgeLabel`): in the sidebar and the Help menu, as a dot on the Help button, and as a dot on the collapsed sidebar. The count refreshes on every page change, when the window regains focus and every minute.

## [0.33.1] - 2026-10-26

### Changed
- The Documentation links in the app point at the new docs at tidemarkanalytics.com/docs. The old links keep redirecting.

## [0.33.0] - 2026-10-26

### Added
- Each site's snippet now uses its own randomized script name and collection address (for example `/js/3fa91c0b2e.outbound-links.js` posting to `/e/3fa91c0b2e`) instead of Plausible-style `script.js` and `/api/event`, so blocklists written for those names miss it. The code is a keyed hash of the site, so nothing is stored and it never changes. Existing snippets keep working: `script.js` and `/api/event` are unchanged.
- A test now fails if a file in the dashboard's assets carries a name that content blockers match on sight (such as plausible or analytics).
- Site lists, the site switcher and the sidebar show each site's own icon, with the letter tile as the fallback. The server fetches and remembers the icon (public https addresses only, small raster images only), so your browser never contacts the site. Set `TIDEMARK_FAVICONS=false` to turn it off.

### Changed
- A new look for the whole app, in the style of Vercel's dashboard and shadcn/ui: Geist fonts (self-hosted), a neutral monochrome interface with teal reserved for data and focus, hairline borders, and light and dark themes that follow your system.
- New navigation: a top bar with a site switcher, a Find box (⌘K) and a live-visitors pill; a sidebar that changes when you enter a site and collapses to icons; and keyboard shortcuts (press `?`).
- One sticky scope bar for the period, comparison, segment and filters, all kept in the URL, with drag-to-zoom on the chart. Comparison with the previous period is now on by default.
- The overview now leads with what changed: headline cards, the chart, a "What changed" card that lists the biggest risers and fallers, and report cards that link to full report pages (Pages, Sources, Locations, Devices, Events and goals, Funnels, Journeys) with search, sorting and CSV export. New sites get a setup checklist.
- The Sites page is a grid or list with status dots and sparklines. Settings pages use cards with footers.
- The key to set a custom range is now `U` (it was `C`, which now toggles comparison), and "All sites" is `g a`.
- The Plausible importer file is renamed so a content blocker that matches its name no longer leaves the dashboard blank.

### Fixed
- The `favicon.ico` shipped with the app was fully transparent; it is now the real app icon.

## [0.32.0] - 2026-10-25

### Changed
- The Tidemark logo now heads every email, including the report and alert emails.
- Account emails (email verification, password reset) now use the same styling as the report and alert emails, instead of the default Laravel look. The theme lives in `resources/views/vendor/mail` and applies to every notification the app sends, including Tidemark Cloud's.

## [0.31.1] - 2026-10-25

### Fixed
- Alert webhooks are now delivered on a default install. They are queued, and the scheduler only ran the queue worker when events were buffered through the queue, so deliveries waited in the queue forever (the Send test button was not affected). The scheduler now runs the worker every minute whenever the queue is not `sync`.

## [0.31.0] - 2026-10-25

### Added
- **MCP server and OpenAPI description.** AI assistants such as Claude can now read a site's stats through a read-only [MCP](https://modelcontextprotocol.io) endpoint at `/api/mcp` (Streamable HTTP, API key as Bearer token, 120 requests a minute). Tools: `list_sites`, `get_stats`, `get_timeseries`, `get_breakdown`, `get_goals`, `list_funnels`, `get_funnel`, `get_current_visitors` and `get_annotations`; every one is read-only and returns aggregates only. Account settings → Security shows the configuration to paste into the assistant. The Stats API and Events API are described in an OpenAPI 3.1 document at `/api/v1/openapi.json`, checked against the real routes by the tests and linted in CI.
- **Read-only API keys.** New keys can be read-only (the default in Account settings): they can read statistics through the Stats API and MCP and nothing else, unlike full-access keys, which still have the same access as their owner. Existing keys stay full-access (`scope` when creating one through the API).
- **Stats API: goals and funnels.** `GET /api/v1/stats/goals`, `/api/v1/stats/funnels` and `/api/v1/stats/funnels/{id}`, next to the existing aggregate, timeseries, breakdown and annotations endpoints.
- **Smarter bot and spam filtering** (Site settings → Tracking → Bot and spam filtering). Besides known crawlers, hits are now left out when they come from a headless browser or a client that sends no language, from the address range of a cloud or hosting provider (Amazon EC2, Google Cloud, Oracle Cloud, DigitalOcean, Linode), from a listed referrer-spam domain, or when one visitor sends more than 120 hits in a minute (`TIDEMARK_FLOOD_PER_MINUTE`, 0 turns it off). Everything is judged from the request in memory; only a daily count per reason is kept, shown as "Filtered in the last 30 days", and never an address or user agent. On by default and can be turned off per site (`bot_filter` in the sites API), for example when testing from a script or a server. The provider and spam lists ship with each release and are refreshed with `php artisan bots:update-lists`.
- **Alerts and webhooks** (Site settings → Alerts). Rules per site, checked every five minutes by the scheduler: a traffic spike or drop against the usual for that weekday and time of day, a goal reaching a number of conversions in a day, new conversions of a goal, and a brand new traffic source. Deliver by email to the site's owners and admins, to a Slack or Discord channel, or to your own endpoint as signed JSON (`Tidemark-Signature: t=…,v1=…`, an HMAC-SHA256 of `timestamp.body`). Rules have quiet hours, cooldowns so a lasting condition is sent once, and webhooks retry with growing pauses; a Send test button shows what the other end answered. Alerts hold totals only, never anything about a visitor. Webhook addresses are stored encrypted and must be public https addresses (`TIDEMARK_WEBHOOKS_ALLOW_PRIVATE=true` allows addresses on your own network).
- **Email reports.** Each person can ask for a weekly or monthly summary of any site they belong to (Account settings → Email reports): visitors, visits, pageviews, bounce rate and visit duration against the period before, the top pages, sources and countries, goals with revenue, and the notes on the graph they can see. Weekly reports arrive on Monday and monthly ones on the 1st, at 08:00 in the site's timezone, and cover the last full week or month. The emails hold only totals, with no tracking pixel and no tracked links, in HTML and plain text, and every one has an unsubscribe link (also one-click unsubscribe in mail apps). They use your existing mail settings and the scheduler (`schedule:run`, which the `reports:send` command hooks into hourly); nothing is sent until outgoing mail is set up.
- **Chart annotations.** Add a short note (up to 280 characters) to any date on the graph, such as "Launched v2" or "Newsletter went out", and it shows as a marker on the chart with the note in the tooltip, and as a Notes column in the table view. Owners and admins choose who sees a note: only you, everyone on the site, or anyone who can see the dashboard (including shared links and public dashboards). Other members can keep private notes. Notes are included in the CSV export (`annotations.csv`) and in the Stats API (`GET /api/v1/stats/annotations`), up to 1,000 per site, and are removed when a site is deleted.
- **Personal data masking.** Email addresses, UUIDs, tokens (long mixed letters and digits, JWTs, hex hashes) and numbers of nine digits or more that sites send by accident, in a page address, referrer, campaign value, event name or event property, are replaced with a placeholder such as `[email]` or `[token]` before anything is stored. Ordinary page names, slugs, dates and short ids are left alone. Site settings → Tracking → Privacy controls shows how many values were masked in the last 30 days, by kind; only those counts are kept, never the values. On by default for every site and can be switched off per site (`pii_scrub` in the sites API). Resetting a site's statistics clears its counts.
- **Small groups** (Site settings → Sharing and access): set a minimum, and public dashboards and shared links leave out rows with fewer visitors than that (countries, pages, sources, property values, journeys and the CSV export), with a note saying so. People who belong to the site always see everything. A filter that would narrow a public view down to a group smaller than the minimum shows no data, so the limit can't be sidestepped by filtering. Totals and the graph still count everyone. Off by default (`min_group_size` in the sites API; 0 is off, otherwise 2 to 1000).
- **Privacy controls** for each site (Site settings → Tracking), so owners can collect even less:
  - Respect Global Privacy Control and Do Not Track: visitors who send the signal are not counted (each is its own switch, both off by default).
  - Location detail: keep country, country and region, or the full country, region and city.
  - Keep only the referrer's domain, without the path of the page that linked to you.
  - Query parameters to keep: page addresses are still stored without their query string, but an owner can allow-list parameters (such as `page` or `lang`) to see them in the Pages report. They are stored sorted by name so one page is one row, and names that look like they carry a secret or personal data (such as `email` or `token`) are refused.
  - New site settings fields `honor_gpc`, `honor_dnt`, `location_precision`, `url_params` and `referrer_domain_only` in the sites API. Nothing changes for existing sites until a switch is turned on.
- **Extension points** for hosts that limit features by plan: `App\Contracts\AllowsAlerts` (alert rules and webhooks) and `App\Contracts\EnforcesPiiScrubbing` (masking of personal data always on, with the setting hidden). Without them every site has both, as before. Sections a plan doesn't include (alerts, webhooks, funnels, branding) now show blurred under a lock with an upgrade link, instead of a notice.

## [0.30.2] - 2026-10-25

### Fixed
- A page added by an extension (such as `/support`) is no longer mistaken for a site dashboard in the sidebar.

## [0.30.1] - 2026-10-25

### Fixed
- Typing in a chat widget on a dashboard no longer triggers the dashboard's keyboard shortcuts.

## [0.30.0] - 2026-10-25

### Added
- A Documentation link in the sidebar and the account menu.

## [0.29.0] - 2026-11-07

### Added
- Branding has a “Show only the logo, not the name” option for a wordmark that already includes the name. The name is then used as the logo’s alt text instead of showing beside it.

## [0.28.3] - 2026-11-07

### Changed
- The sign-in pages use a wave pattern that spans the full width of any screen, in place of the contour lines with depth numbers, which stopped short of the edges on large, high-resolution displays.

## [0.28.2] - 2026-11-07

### Fixed
- On phones, a goal list with revenue columns no longer pushes the page wider than the screen: the columns are narrower, the goal name gets its own line, and the Average column is hidden on very small screens (it stays in Details).

## [0.28.1] - 2026-11-07

### Changed
- An extension can now keep an administrator's site list to their own sites with no mention of the others (an empty path from `LimitsSiteList`), so a hosted service's customer interface never hints at other customers.

## [0.28.0] - 2026-11-07

### Added
- Extensions can provide a separate administration interface (`registerAdminUi`). Administrators get an Admin link in the sidebar, and Users and Updates move out of Account settings into that interface. Without an extension nothing changes.

## [0.27.1] - 2026-11-07

### Fixed
- On phones, the site list opened below the Filter row instead of right under the site button.

## [0.27.0] - 2026-11-07

### Changed
- Site settings are grouped into four tabs: Tracking (snippet, extras and shields), Conversions (goals and funnels), Sharing and access (people, public dashboard, shared links and branding) and Data (reporting timezone, export and import, and the danger zone). Rollups have Sites, Conversions, Sharing and Data. Links to the old tabs still work.
- Account settings are four tabs: Profile, Security (password, two-factor and API keys), Users and Updates, alongside any tabs your install adds. The light, dark or system theme is chosen under Profile; the toggle is gone from the sidebar, the top bar and the command palette for signed-in users, and stays on public and shared dashboards.
- Goals, funnels, shared links, people, branding, shields, rollup sites, API keys and users have a new look: inline forms and lists instead of pop-ups and tables, empty states, and a live preview for branding.
- The filter menu is calmer: after choosing what to filter by, one search box with the operator beside it lists the values with their visitor counts. Tick several, or type to narrow the list and press Enter, then apply. Filters have icons, the Filter button shows how many are active, and Save as segment and Manage segments have a cleaner layout.
- The sidebar keeps the same Workspace links on every page (Sites, Account, and Users and Updates for administrators) with Community and support under Help. The sites list also shows your busiest sites. The site switcher appears only while you are inside a site, and switching keeps you on the same settings page. The back links on the settings pages are hidden where the sidebar is shown.

### Fixed
- A long email address no longer gets cut off in the account menu in the sidebar; it wraps onto a second line.

## [0.26.0] - 2026-11-06

### Changed
- The sidebar's list of sites is now a searchable dropdown at the top, so it stays tidy with many sites. Open it, type to filter, and press Enter to jump to a site. The dashboard sections stay in the sidebar on a site's settings pages, and choosing one from there opens the dashboard at that section.
- Updated Laravel and the build tooling to their latest releases.

### Fixed
- "Save as segment" and "Clear all" now line up with the filter chips, and the chips in the Edit filter menu have proper padding.
- The sidebar could highlight Conversions after returning to the dashboard from settings.

## [0.25.0] - 2026-11-05

### Changed
- A new look and layout. A harbor sidebar lists your sites and the sections of the open dashboard, with a ⌘K command palette to jump between sites, change the date range, compare or filter.
- The dashboard opens with a plain-language summary and the top channel, page and country, then KPI tiles with a sparkline each, then Traffic, Audience and Conversions sections.
- Settings sections are a tab bar under the title; the sites list shows the combined visitor count.

## [0.24.0] - 2026-11-04

### Changed
- A rollup's goals can now report revenue. A rollup adds up only the amounts its sites sent in the goal's own currency, because the sites' goals may report in different ones.

## [0.23.0] - 2026-11-03

### Added
- **Rollups.** One dashboard that adds up several of your sites (Your sites → Create a rollup). Choose the sites, or include all of them, including ones you add later. A rollup has the dashboard you know, with its own goals, funnels, segments, branding, visibility and shared links, and its timezone starts as the one most of its sites use. Your sites keep their own dashboards and data. Imported data and revenue goals are left out (the sites may use different currencies), and a rollup only ever shows sites you belong to. Extensions can limit who may create them with the new optional `App\Contracts\AllowsRollups`.

## [0.22.1] - 2026-11-02

### Fixed
- The top stats show the date ranges and previous values only while a comparison is switched on; otherwise they show just the value and its change, as before.

## [0.22.0] - 2026-11-02

### Added
- **Segments.** Save the filters on screen as a named segment (Filter → Save current filters as segment) and apply it later from the Filter menu. A personal segment is yours alone; owners and admins can share one with everyone who can see the site, including public and shared dashboards. Rename, update or delete them under Filter → Manage segments.
- **Journeys.** A new Explore tab in Behaviors follows visits step by step: choose a starting point (or switch to an ending point) and see what visitors did next, then pick a step to go deeper. Pages, folders (`/blog/*`) and custom events are all steps, and visit filters such as country or source narrow who is counted.
- Extensions can limit both with the new optional `App\Contracts\AllowsExploration`, next to `Entitlements`. Without it every site may use them.

### Fixed
- Deleting a site now also removes its funnels and segments.

## [0.21.0] - 2026-11-01

### Changed
- Dashboard behaviour now follows Plausible's more closely. "Last 7 / 28 / 91 days" end with yesterday, because today is still partial (Month to date and Year to date still include today). The date menu has Yesterday, Last month and Plausible's keyboard shortcuts (D, E, R, H, W, F, N, M, P, Y, L, A, C, X); Last 30 days and Last 6 months are no longer offered but old links keep working, and the filter shortcut `F` is gone because `F` now picks Last 28 days.
- Comparison has its own control next to the date ("vs Previous period"), and the top stats show each metric's date range with the previous value underneath.
- The period you last chose on a site is remembered in your browser.
- The Campaigns tab lists UTM mediums, sources, campaigns, contents and terms in Plausible's order.

## [0.20.0] - 2026-11-01

### Added
- **Funnels.** Chain two to eight goals into a funnel (Site settings → Funnels) and see how many visitors complete each step, in order, with the drop-off between steps, in the Behaviors panel. Visit-level filters such as country or source narrow who is counted.
- **Revenue.** Give a custom-event goal a currency (Site settings → Goals) and send an amount with the event: `plausible('Purchase', { revenue: { amount: 29.99, currency: 'USD' } })`, the Events API's `revenue` field, or the `plausible-revenue-amount` and `plausible-revenue-currency` classes with `tagged-events`. Filtering by that goal shows total and average revenue in the top stats, the graph, the Goals list and every report. Revenue sent in another currency is converted with the European Central Bank's daily rates (`tidemark:refresh-rates`, fetched only when a goal reports revenue; turn off with `TIDEMARK_EXCHANGE_RATES=false`).
- The Stats API accepts `events`, `conversion_rate`, `total_revenue` and `average_revenue` metrics with a goal filter. Site exports and imports carry funnels, goal currencies and event revenue. The CSV export gains revenue columns and `funnels.csv`.
- Extensions can limit these with the new optional `App\Contracts\AllowsConversionReports`, next to `Entitlements`. Without it every site may use them.

## [0.19.1] - 2026-10-24

### Fixed
- The PNG app icons (home-screen and web app icons) were cropped off-centre or blank; they are re-rendered from the logo.

## [0.19.0] - 2026-10-24

### Added
- The account menu links to the Tidemark community on Discord.

## [0.18.0] - 2026-10-23

### Added
- Extensions can keep an administrator's site list and site switcher to the sites they belong to, by implementing the new optional `App\Contracts\LimitsSiteList` next to `Entitlements`. The Sites page then points to where the other sites can be browsed. Self-hosted installs are unchanged: administrators still see every site.

## [0.17.0] - 2026-10-23

### Added
- Account menu entries registered by an extension can run a function instead of opening a link: `registerMenuItem({ label, onClick, icon })`.

## [0.16.2] - 2026-10-23

### Changed
- Stat cards: the change against the previous period is plain coloured text instead of a pill, the padding above and below is even, and the number scales with the card so the number and its change always stay on one line. The six-card row now switches to three columns below 1140 px, where the cards would otherwise be too narrow.

## [0.16.1] - 2026-10-23

### Changed
- The stat cards above the graph are shorter. The change against the previous period now sits to the right of the number instead of on its own line, so the cards are the same compact height whether or not a comparison is shown (on narrow cards it wraps below).

## [0.16.0] - 2026-10-23

### Added
- Import from Plausible. In a site's Settings → General, upload the zip that Plausible's Settings → Imports & exports prepares. The browser reads it and sends the numbers in batches, so very large exports work (a 215 MB export of 3.6 years imports in about a minute).
- Imported days are daily totals added to the top stats, the graph and the reports (sources, channels, referrers, UTM fields, pages, entry and exit pages, countries, regions, devices, browsers, operating systems, and custom events for matching goals). They are left out while a filter is applied, only days before Tidemark's first recorded visit are imported, and importing again replaces the earlier import. "Remove imported data" undoes it.

## [0.15.2] - 2026-10-22

### Changed
- The Docker image accepts `PUID` and `PGID` (default 1000) and gives `/data` to that user on start, so bind-mounted folders work without a manual `chown`. Unraid's `99:100` works out of the box.

## [0.15.1] - 2026-10-22

### Changed
- A site's brand color now takes over the whole public page, not just the accents: backgrounds, borders and text pick up its hue, in both the light and the dark theme.
- The brand color is checked for contrast (WCAG AA). If the chosen color is too light or too dark for readable text, buttons or chart lines, Tidemark uses the closest shade that passes, and the Branding settings say which shades visitors will see.

## [0.15.0] - 2026-10-22

### Added
- Branding for public pages. In a site's settings, a new **Branding** tab sets a display name, a brand color and a logo (PNG, JPEG, WebP or SVG up to 100 KB). People who open the public dashboard or a shared link see them in the header and as the interface accent; signed-in members keep the normal look.
- Public dashboards and shared links now end with a small "Analytics by Tidemark" link (`TIDEMARK_BRAND_URL` changes where it points).
- Extensions can limit branding by implementing the new optional `App\Contracts\AllowsBranding` next to `Entitlements`. Self-hosted installs have no limit.

## [0.14.0] - 2026-10-22

### Added
- A Docker image, `ghcr.io/tidemark-apps/analytics`, for amd64 and arm64. It runs the app and its scheduler in one container, keeps everything that changes in a single `/data` volume, and works with SQLite, MySQL, MariaDB or PostgreSQL. A `docker-compose.yml` is included. Updating means pulling a newer image; the in-app updater is switched off inside the container.

## [0.13.1] - 2026-10-22

### Fixed
- The icon sprite is now versioned like the scripts, so a newly added icon shows up straight after an update instead of staying blank until the browser's or CDN's cached copy of the sprite expires.

## [0.13.0] - 2026-10-22

### Added
- Extensions can add an entry to the account menu with `registerMenuItem({ label, href, icon, external, visible })`.

## [0.12.4] - 2026-10-23

### Changed
- The terms, privacy and refund links on the sign-in and sign-up pages now sit at the bottom of the page instead of inside the card.

## [0.12.3] - 2026-10-21

### Fixed
- When the dashboard updater is turned off (`TIDEMARK_UPDATER=false`), saving your profile no longer brings the Updates tab back in Account settings. The saved-profile response now carries the same flag as every other user response.

## [0.12.2] - 2026-10-21

### Fixed
- After an update, browsers and CDNs no longer keep serving old dashboard scripts: every script module is now requested with a version in its address (through an import map), so a new release is picked up straight away without clearing any cache.

## [0.12.1] - 2026-10-21

### Fixed
- Report lists: the column headers (Visitors, Conversions, CR, Uniques, Total) now line up exactly with their values.
- The Locations panel now has a Details link like the other reports.
- Phones: the dashboard toolbar keeps the site and live count on one row and Filter, date and menu on the next, with popovers that fit the screen; the Settings sections scroll to the one you are on.
- Code snippets wrap at spaces instead of mid-word, and keep the Copy button on its own line on narrow screens; the first-pageview card stacks on phones.
- Metric tiles no longer show a meaningless 0% badge when there is nothing to compare, and the filter menu's heading lines up with its items.
- The Import a file button now matches the other buttons.

## [0.12.0] - 2026-10-21

### Added
- Move your data: Site settings now has a "Move your data" section. Download a site's raw visits and events as one file, and import that file into any other Tidemark install, for example to move from self-hosted to Tidemark Cloud. Imports run in the browser in small batches, can be repeated safely (visits already there are skipped), and bring over the site's goals.
- `App\Contracts\LimitsImportedHistory`, an optional companion to `Entitlements` that lets an extension cap how far back an import may reach.

## [0.11.2] - 2026-10-21

### Added
- `TIDEMARK_TERMS_URL`, `TIDEMARK_PRIVACY_URL` and `TIDEMARK_REFUNDS_URL`: when set, the sign-in and sign-up screens link to your legal pages, and sign-up says that creating an account means agreeing to the terms.

## [0.11.1] - 2026-10-21

### Added
- `TIDEMARK_UPDATER=false` turns off updating from the dashboard (the Updates tab and its endpoints). For deployments that build and ship their own releases.

## [0.11.0] - 2026-10-21

### Added
- **Password reset.** With an SMTP server configured, the sign-in page offers "Forgot your password?" and emails a one-hour link.
- **Optional email verification.** `TIDEMARK_VERIFY_EMAIL=true` makes new accounts confirm their address before adding sites. Existing accounts and accounts created by an administrator count as verified.
- **Extension points** for packages that build on Tidemark: an `Entitlements` contract (site creation and per-event recording checks), a `SiteCreated` event, and dashboard modules that can add Account settings tabs, banners and pages.

### Removed
- `TIDEMARK_MAX_EVENTS`, which was never enforced. Event quotas belong in an `Entitlements` implementation.

## [0.10.4] - 2026-10-20

### Fixed
- On the world map, a hovered country's outline was partly hidden behind neighboring countries that are drawn after it. The outline is now drawn on top of all of them.

## [0.10.3] - 2026-10-20

### Fixed
- Update detection no longer depends on GitHub's API, whose anonymous rate limit shared hosts often exhaust. The newest version is read from github.com's release redirect; the API is only used for release notes. This could leave the update dot and the Updates page empty on shared hosting.
- Installed copies re-check every 6 hours while an administrator is using the app (they used to wait 24), so a new release shows its dot the same day.

## [0.10.2] - 2026-10-20

### Fixed
- In code boxes with a Copy button (for example the public dashboard link), the text and the button now sit on the same center line.

## [0.10.1] - 2026-10-20

### Added
- Clicking a goal such as "Outbound Link: Click" or "File Download" now drills down: the Behaviors panel shows an "Outbound links" / "File downloads" / "Form submissions" tab listing the URLs (or pages) behind it, with conversions and conversion rate. Outbound and download URLs have an open-in-new-tab icon.

### Fixed
- Clearing a goal filter with its × updated the address bar but left the dashboard stuck on the filtered view (the graph crashed on stale data). It now clears properly.

## [0.10.0] - 2026-10-20

### Added
- Automatic update checks: once a day (a scheduled task, and also when an administrator is using the app, so no cron is needed) Tidemark asks GitHub for the latest release version. When a newer one exists, a dot appears on the profile menu, next to **Account settings**, and next to **Updates** inside it. Only the version number is requested; nothing about your sites or visitors is sent. Turn it off with `TIDEMARK_UPDATE_CHECK=false`. New command: `php artisan tidemark:check-updates`.

### Changed
- Version 0.9.x only contacted GitHub when an administrator opened Account settings → Updates. The daily check is on by default; set `TIDEMARK_UPDATE_CHECK=false` to keep the old behavior.

## [0.9.6] - 2026-10-20

### Changed
- American English throughout: the report panel is now "Behaviors", and docs, brand guide and code comments use US spellings.

## [0.9.5] - 2026-10-20

### Changed
- The release zip is back to unpacking into a `tidemark-x.y.z/` folder, as in 0.9.3 and earlier. 0.9.4 (which put files at the archive root) was a mistake; the in-app updater accepts either layout, so nothing else changes.

## [0.9.3] - 2026-10-20

### Fixed
- Public dashboards redirected signed-out visitors to the login page, because the site switcher requested the signed-in-only site list. Signed-out viewers now see the dashboard.

## [0.9.2] - 2026-10-20

### Fixed
- The event endpoint (`POST /api/event`) answered with a `tidemark-session` cookie. It no longer starts a session or sets any cookie, so tracking is cookie-free as documented. **Upgrade promptly if you rely on that claim.**

## [0.9.1] - 2026-10-20

### Fixed
- Replacing the files by hand (FTP) now runs the pending database migrations on the first request, the same as an in-app update. Previously nothing triggered them.
- `.env.example` described the visitor-id salt as monthly; it changes daily.

## [0.9.0] - 2026-10-20

### Added
- One-click updates: Account settings → Updates checks GitHub for the latest release, downloads it, verifies its SHA-256 checksum and installs it. Nothing is requested until an administrator opens that page; set `TIDEMARK_UPDATE_REPO` to point at a fork.

### Changed
- CI uses `actions/checkout` and `actions/upload-artifact` v7.

## [0.8.0] - 2026-10-20

First public release.

### Added
- Plausible-style dashboard: visitors, visits, pageviews, views per visit, bounce rate and visit duration with period comparison, plus Sources, Pages, Locations, Devices and Behaviors reports.
- Filters (is, is not, contains, does not contain, wildcards), goal-based conversion mode, custom properties, realtime view, CSV export.
- Plausible-compatible tracking script (`script.<variants>.js`) and Events API (`POST /api/event`).
- Cookie-free visitor ids from a daily-rotating salted hash; IP addresses are never stored.
- Public dashboards and password-protectable shared links, goals, shields (IP, country, page, hostname), roles per site.
- Stats API v1 subset with API keys, two-factor sign-in.
- Web installer for shared hosting, queue ingestion option, separate analytics database connection.
- In-app updater: upload a release zip under Account settings → Updates.
