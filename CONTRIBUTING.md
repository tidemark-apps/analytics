# Contributing to Tidemark Analytics

Thanks for helping! Tidemark Analytics aims to stay small: one clear dashboard, easy installs on shared hosting, and no personal data collected. Changes that fit that spirit are very welcome.

Want to talk something through first? Join the [Tidemark community](https://community.tidemarkanalytics.com) and start a thread there.

## Getting started

```bash
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
php artisan tidemark:demo     # fake traffic; login demo@example.com / password
php artisan serve
```

The dashboard is a no-build Preact app in `public/assets/js` (ES modules, no Node needed). Icons are Lucide, built into one sprite by `scripts/build-icons.mjs`.

## Branches and releases

Tidemark uses two long-lived branches:

| Branch | Purpose |
| --- | --- |
| `main` | What has shipped. Every release is tagged here (`vX.Y.Z`), and the release workflow builds the zip and Docker image from the tag. |
| `develop` | Staging for the next release. Finished features and fixes are grouped here and tried together before a release. |

Day to day:

1. Branch from `develop`: `feature/short-name` for new behavior, `fix/short-name` for bug fixes, `docs/short-name` for documentation. Keep a branch to one change, so it is easy to review and to revert.
2. Open a pull request **into `develop`**. CI must pass. Feature pull requests are squash-merged, so each lands as one commit with a clear message.
3. Add a line under `## [Unreleased]` in `CHANGELOG.md` in the same pull request (see below).
4. When `develop` holds what the next release should, a maintainer opens a pull request from `develop` into `main`, sets the version in `VERSION`, renames `[Unreleased]` in the changelog to the version and date, merges it with a merge commit, and tags `main`.
5. Urgent fixes for a shipped version go on a `hotfix/short-name` branch from `main`, into `main` by pull request, are tagged as a patch release, and are then merged back into `develop`.

Versions follow [Semantic Versioning](https://semver.org/): a patch for fixes, a minor for new features, a major for breaking changes. Database migrations must be safe to run on an existing install.

Commit messages are short, imperative and say what changed ("Add saved segments", not "added stuff").

### Changelog

User-facing changes are listed under `## [Unreleased]` in `CHANGELOG.md`, grouped as `### Added`, `### Changed`, `### Fixed` or `### Removed`. Write them for the people who run Tidemark, not for developers: what is different for them, in plain words. Refactors, tests and CI changes do not need an entry.

## Before you open a pull request

- `php artisan test` passes and new behavior has a test.
- `vendor/bin/pint` leaves nothing to fix.
- The change works on SQLite, MySQL/MariaDB and PostgreSQL (use the helpers in `App\Analytics\Support\Sql` instead of vendor-specific SQL).
- User-facing changes are noted in `CHANGELOG.md`.
- The pull request targets `develop` (or `main` only for a hotfix).
- Interface changes work in light and dark themes and on a phone-width screen, and include a screenshot in the pull request.
- Keep the shared-hosting promise: no required Node, Docker, SSH, daemons or non-bundled PHP extensions.

## How the code is organised

- `app/Analytics` holds the analytics itself: `Ingest` (collector and event sink), `Stats` (every query behind the dashboard) and `Support` (periods, filters, SQL helpers).
- `app/Http/Controllers/Api` is the JSON API the dashboard and the Stats API use.
- `public/assets/js` is the dashboard. Pages are ES modules; shared helpers are in `lib.js` and UI pieces in `ui.js`. There is no build step.
- `tests/Feature` covers the API and the analytics; add a test next to the behavior you change.
- Optional behavior, such as plans and limits on Tidemark Cloud, is added through the small contracts in `app/Contracts` rather than by branching on the environment.

## Privacy rules

Never store IP addresses, raw user agents or anything that follows a person across days. Pull requests that weaken this will not be merged.

## Reporting security issues

Please don't open a public issue — see [SECURITY.md](SECURITY.md).
