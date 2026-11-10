<?php

return [

    // Whether administrators can update Tidemark from Account settings → Updates. A hosted deployment that builds and deploys its
    // own releases turns this off so nobody can overwrite it with the public release by accident.
    'updater' => (bool) env('TIDEMARK_UPDATER', true),

    // GitHub repository checked for new releases when an administrator opens Account settings → Updates.
    // Look for new releases daily (a cron task) and every few hours while an administrator is using the app so the dashboard can
    // show an "update available" dot. Only the latest version number is requested; nothing about your sites or visitors is sent.
    // Daily euro reference rates from the European Central Bank, only fetched when a goal reports revenue, to add up revenue sent in different currencies.
    'exchange_rates' => (bool) env('TIDEMARK_EXCHANGE_RATES', true),
    // Hits per minute from one visitor beyond which the rest are treated as a flood and left out (0 turns the check off).
    'flood_per_minute' => (int) env('TIDEMARK_FLOOD_PER_MINUTE', 120),

    // Alert webhooks only reach public internet addresses, so a rule can't be used to probe the network the server runs on.
    // Self-hosters who deliver to a service on their own network (a local Slack bridge, Home Assistant…) can allow that here.
    'webhooks' => ['allow_private' => (bool) env('TIDEMARK_WEBHOOKS_ALLOW_PRIVATE', false)],

    // The dashboard shows each site's own icon in site lists. The server fetches it (the viewer's browser never contacts the site), only from
    // public https addresses. Turn this off on a server without internet access; the dashboard then shows letter tiles.
    'favicons' => (bool) env('TIDEMARK_FAVICONS', true),

    'update_check' => (bool) env('TIDEMARK_UPDATE_CHECK', true),

    'update_repo' => env('TIDEMARK_UPDATE_REPO', 'tidemark-apps/analytics'),

    // Installed release, stamped into the VERSION file by scripts/build-release.sh.
    'version' => is_file(base_path('VERSION')) ? trim((string) file_get_contents(base_path('VERSION'))) : 'dev',

    /*
    | Deployment mode.
    |   self-hosted : one installation, one operator (shared hosting friendly)
    |   cloud       : multi-tenant cell; open registration, plan limits & quotas
    */
    'mode' => env('TIDEMARK_MODE', 'self-hosted'),

    'registration' => (bool) env('TIDEMARK_REGISTRATION', env('TIDEMARK_MODE', 'self-hosted') === 'cloud'),

    /*
    | Database connection that holds the high-volume tables (visits, events,
    | event_props). Defaults to the application connection. Point it
    | at a different server to split analytics from metadata, or at a read
    | replica/shard in a cloud cell.
    */
    'analytics_connection' => env('TIDEMARK_ANALYTICS_DB', null),

    /*
    | Event ingestion strategy.
    |   sync  : write straight to the database inside the request (default)
    |   queue : push to the queue; a worker (or the scheduler on shared hosting)
    |           inserts events in batches
    */
    'ingest' => env('TIDEMARK_INGEST', 'sync'),
    'ingest_queue' => env('TIDEMARK_INGEST_QUEUE', 'ingest'),

    // Headers (in order) checked for the client IP when behind a proxy/CDN.
    'ip_headers' => ['CF-Connecting-IP', 'X-Client-IP', 'X-Forwarded-For', 'X-Real-IP', 'X-Appengine-User-Ip', 'True-Client-IP'],

    // Optional MaxMind GeoLite2/GeoIP2 City database (needs `composer require geoip2/geoip2`).
    'geoip_database' => env('TIDEMARK_GEOIP_DATABASE', storage_path('app/geo/GeoLite2-City.mmdb')),

    'ignore_ips' => array_filter(array_map('trim', explode(',', env('TIDEMARK_IGNORE_IP', '')))),
    'allowed_hostnames' => array_filter(array_map('trim', explode(',', env('TIDEMARK_HOSTNAMES', '')))),
    'disable_bot_filter' => (bool) env('TIDEMARK_DISABLE_BOT_FILTER', false),

    // Delete raw events older than N days (0 = keep forever). Run by the scheduler.
    'retention_days' => (int) env('TIDEMARK_RETENTION_DAYS', 0),

    // Visitor ids are derived from a salted hash; the salt changes every day, so visitors can't be followed across days.
    'salt' => env('TIDEMARK_SALT'),

    // Require new accounts to confirm their email address (needs working mail settings) before they can add sites.
    'verify_email' => (bool) env('TIDEMARK_VERIFY_EMAIL', false),

    // E-mail invitations: sharing a site with an address that has no account sends an invitation instead of failing. Off by default
    // on self-hosted installs (accounts are then created by an administrator); on for Cloud. Needs working mail settings.
    'invites' => (bool) env('TIDEMARK_INVITES', env('TIDEMARK_MODE', 'self-hosted') === 'cloud'),
    // Set by a host that runs this install for someone else (TIDEMARK_HOSTED=true, as in the Docker image's hosted mode): settings that live
    // in the environment, such as outgoing email, are the host's to manage, and the app says so instead of pointing at the .env file.
    'hosted' => filter_var(env('TIDEMARK_HOSTED', false), FILTER_VALIDATE_BOOLEAN),
    // A JSON file that sets this install's plan (limits, paused or not, which features are on); see App\Support\PlanFile. Unset means no limits.
    'plan_file' => env('TIDEMARK_PLAN_FILE'),

    // The public key (base64, Ed25519) of the service that hosts this install. It lets that service send customers straight in from its
    // portal and open support sessions; see App\Support\HostToken. Unset turns both off.
    'sso_public_key' => env('TIDEMARK_SSO_PUBLIC_KEY'),
    // Whether the host's support may open read-only sessions on this install (the owner sees each one in Settings → Security).
    'support_access' => (bool) env('TIDEMARK_SUPPORT_ACCESS', true),

    // Organizations, teams and moving sites between them. Turn off for an install that serves one customer: everyone keeps their
    // Personal organization behind the scenes and sites are shared with people one by one.
    'organizations' => (bool) env('TIDEMARK_ORGANIZATIONS', true),
    // How many organizations (besides Personal) one person may own.
    'organization_limit' => (int) env('TIDEMARK_ORGANIZATION_LIMIT', 10),
    'invite_hours' => (int) env('TIDEMARK_INVITE_HOURS', 72),
    'invite_daily_limit' => (int) env('TIDEMARK_INVITE_DAILY_LIMIT', 20),
    'invite_pending_limit' => (int) env('TIDEMARK_INVITE_PENDING_LIMIT', 100),

    // Where the "Analytics by Tidemark" link in the footer of public dashboards points.
    'brand_url' => env('TIDEMARK_BRAND_URL', 'https://hellotidemark.com/analytics/'),

    // Where the "upgrade your plan" links on locked features lead (opens in a new tab). A hosting service that sells plans sets this to
    // its own page; left empty, they stay inside the app.
    'upgrade_url' => env('TIDEMARK_UPGRADE_URL'),

    // Links to your legal pages. When set, the sign-in and sign-up screens show them, and sign-up says that creating an account
    // means agreeing to the terms. (A hosted service typically needs all three; self-hosters can leave them empty.)
    'legal' => [
        'terms' => env('TIDEMARK_TERMS_URL'),
        'privacy' => env('TIDEMARK_PRIVACY_URL'),
        'refunds' => env('TIDEMARK_REFUNDS_URL'),
    ],

    // Extra first path segments that are not site dashboards or rollup names (e.g. the pages of a marketing site on the same host).
    'reserved_names' => array_filter(array_map('trim', explode(',', env('TIDEMARK_RESERVED_NAMES', '')))),

    // JavaScript modules an extension package adds to the dashboard (see public/assets/js/extensions.js).
    'extensions' => [],

    // Plan limit (0 = unlimited). Extension packages can enforce richer limits through App\Contracts\Entitlements.
    'limits' => [
        'sites_per_user' => (int) env('TIDEMARK_MAX_SITES', 0),
    ],

];
