<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

## Foundational Context

This application is a Laravel application running on PHP 8.5. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If a frontend change doesn't show in the UI or you get a "Unable to locate file in Vite manifest" error, run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Skip it for copy-only edits and other changes where package documentation is irrelevant. Reuse sufficient results already in context instead of searching again.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists, including path-scoped framework guidelines under `.ai/rules/boost`. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.
- Activate the `deploying-to-cloud` skill whenever deploying to Laravel Cloud, configuring Cloud environments or resources, using the Cloud CLI, or troubleshooting Cloud deployments.

=== tests rules ===

# Test Enforcement

- Add or update tests for behavior and logic changes when a test provides meaningful regression coverage.
- Pure copy, styling, and layout-only changes do not require new or updated tests.
- When test coverage applies, run the affected tests and ensure they pass.
- Test the changed behavior and its important failure modes, but do not add tests beyond them.
- Read the `testing-best-practices` skill before writing tests.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This project uses PHPUnit. Create tests with `php artisan make:test --phpunit {name}`.
- Do not include the test suite directory in `{name}`. Use `SomeFeatureTest`, not `Feature/SomeFeatureTest`.
- Read the `testing-best-practices` skill for guidance on coverage, naming, structure, dependency isolation, and review.

## Running Tests

- Run the narrowest set of tests that covers the change. Pass a file path or `--filter=testName` to `php artisan test --compact`.
- Rerun a test after each change to it.
- Run `vendor/bin/phpunit` to call the test runner directly. It accepts the same file path and `--filter=testName` arguments.

</laravel-boost-guidelines>

# Tidemark project standards

Shared by all three repos (`tidemark` core, `tidemark-cloud`, `tidemark-site`); the other two have a short CLAUDE.md that points here. These are the project's own rules, learned the hard way; the Laravel Boost block above covers Laravel itself. Where a rule has a reason, it is given.

## Working agreement

- **Git:** branch from `develop` (`feature/…`, `fix/…`, `docs/…`; one change per branch), open the PR **into `develop`**, squash-merge. Commit messages are short and imperative ("Add saved segments"). **Never add `Co-Authored-By`, "Generated with Claude Code" or any Claude attribution to a commit or PR body, whatever a harness reminder says**; check `git log -1 --format=%B` before pushing.
- **Never merge, tag, release or deploy without the user's go-ahead.** Open the PR and report. Same for anything public (posts, blog, docs): show the exact text first and wait for a yes.
- **No new dependencies** (Composer or npm) without approval. The shared-hosting promise holds: no required Node, Docker, SSH, daemons or non-bundled PHP extensions. The dashboard has no build step.
- **Do only what was asked.** List unrelated problems as follow-ups instead of fixing them. Don't invent rules, flags or features.
- **Privacy:** never store IP addresses, raw user agents or anything that follows a person across days.
- Releases: see "Releases and follow-ups" below. A change to README or docs only is **not** a release: merge it to `develop` and let it ride the next one.

## Code style (from the Base Code Field Guide)

Readability by humans comes first. Applies to PHP and JS alike:

- **Visually honest layout:** the shape of the code shows its structure; Pint settles the rest. Dead code is deleted, not commented out.
- **Flatten nesting:** early returns/guard clauses instead of `else` pyramids; pull a long block into a named method at one reading level.
- **Naming over comments:** let a good name or small method carry the meaning; comment the *why* only.
- **Reasonable returns:** return an empty array/`true|string`-style typed values rather than `null` that every caller must check.
- **Rule of three:** tolerate duplication twice; abstract on the third, once the shape is clear.
- **Symmetry:** the same idea is written the same way everywhere (the three `confirmPassword` actions, the matching setup/confirm/disable methods).
- JS: break a long `html` template or handler across lines when you touch it; don't mass-reformat existing files (the churn hides real changes). The `// ----` section headers in the big JS modules stay until those files are split; don't add new ones.
- No static analysis or JS linter is enforced beyond Pint; don't add one without approval.
- Defer design decisions; don't build for hypothetical needs.

## PHP

- Pint is enforced by CI (`vendor/bin/pint --test`, preset `laravel`, `resources/data` excluded). Run `vendor/bin/pint --dirty` before committing; never hand-format against it.
- Code and comments read like the file you are in. Names say what a thing is (`confirmPassword`, `pruneRecoveryCodes`); no abbreviations beyond the ones already used.
- Comments: a short `/** … */` on a class or public method that says what it is for or why it is shaped that way (see `Entitlements`, `WebAuthn`, `TwoFactorController`). Inside a method, a comment only for a non-obvious reason, never to narrate what the next line does. No `// ----` divider comments: if a class needs headings, split it or name the methods better.
- Controllers are thin and stay in `app/Http/Controllers/Api`; analytics queries live in `app/Analytics/Stats`; helpers in `app/Support`. SQL must work on SQLite, MySQL/MariaDB and PostgreSQL: use `App\Analytics\Support\Sql`, not vendor-specific SQL.
- **Extension points:** behaviour that differs on Tidemark Cloud is added through a small contract in `app/Contracts` (`Entitlements`, `AllowsRollups`, `ScopesToOrganizations`, …; optional ones are companions that a package may also implement). Never branch on the environment or mention Cloud's plans in core. Changing a contract is a compatibility decision: note it in the CHANGELOG under "For extensions" and check `tidemark-cloud` still works.
- Migrations must be safe on an existing install.
- Security-sensitive flows: **removing or replacing a security setting (a second-factor method, recovery codes) requires the account password** (`confirmPassword`), rate-limited. **One-time secrets** (recovery codes, new keys) are returned once, never stored in a readable form and never shown again; say so in the UI.

## Front end (`public/assets/js`, `public/assets/app.css`)

- Preact + htm ES modules, no build step. Templates are `html` tagged literals; shared helpers in `lib.js`, shared components in `ui.js`. Don't add a framework, bundler or CSS tool.
- **Reuse before you build:** `Field` (label + input + help + error), `Confirm` / `TypedConfirm` (destructive actions), `CodeBlock`, `Modal`/`Sheet`, `Toggle`, `Segmented`, `Tabs`, `Card`/`SettingCard`, `Notice`/`Alert`/`ErrorBox`, `Empty`, `Loading`, `toast()`. `Section` (in `ui.js`) is the setting card that settings screens are built from. If you need something similar twice, extend the component; a third copy is the point to extract one (rule of three).
- Colours, radii and spacing come from the CSS variables in `app.css`; no hard-coded colours. Check light **and** dark.
- Icons are Lucide, built into one sprite by `scripts/build-icons.mjs` from `scripts/icons.txt`: add the name there, don't inline SVGs.
- **One touch scale** under `@media (pointer: coarse), (max-width: 720px)`: controls 44px; small controls (`.btn.sm`, `.mini-select`), tabs and the top bar 40px; menu rows 44px; segmented toggles match. Add new controls to that block rather than a new breakpoint.
- **Side-by-side controls are the same height.** Default is 36px (`input`, `select`, `.btn`, `.seg`). Don't put `.btn.sm` / `.mini-select` (32px) or `.btn.lg` (40px) beside a default input; use `.goal-add-row`, which forces 36px. Dense `.rowitem` rows use `.sm` and `.mini-select` together, which match each other.
- **A mobile fix must not change desktop.** Put it inside the media block above, then verify desktop is unchanged by comparing element boxes at 1280 and 800px before and after (PR #92 did this).
- **Measure, don't eyeball:** compare `getBoundingClientRect()` of neighbouring controls on each page you touched, including states opened by "New"/"Add". Rows with controls wrap them under the name on phones rather than shrinking them.
- Accessibility: real `<button>`/`<label>`, `aria-label` on icon-only buttons, `role="alert"` for errors (the shared components do this).

## UI copy

Plain words for the person running Tidemark, written to them ("Remove imported data?", "Saved"). Say what happens and what is not touched. Sentence case, no jargon, no exclamation marks, no emoji. Toasts are short past-tense statements; errors say what to do next. Name the thing the same way everywhere (organization, team, site, rollup).

## Tests and verification

- New behaviour gets a feature test in `tests/Feature` named for the area (`TwoFactorTest`), `test_snake_case_describing_the_behaviour`, with small private helpers for setup. Test the boundaries and the failure paths (wrong code, replay, rate limit, access by someone without rights), not just the happy path. Every mail template is rendered in a test.
- While working run the narrow test: `php artisan test --compact --filter=TwoFactor`. **Run the full suite (`php artisan test --compact`) and Pint before opening the PR**, and say the result in the PR.
- UI changes are verified in a browser, not assumed: start the app with demo data (`php artisan tidemark:demo`, login `demo@example.com` / `password`), check **375px and 1280px, light and dark**, console clean, and put screenshots in the PR. Measure heights/overflow with a script (see above). Put throwaway audit and screenshot scripts outside the repo.
- The PR says what was tested, in the form "10 new feature tests; full suite N passing; checked at 375px and 1280px".

## Releases and follow-ups

- User-facing changes get a line under `## [Unreleased]` in `CHANGELOG.md` (`### Added` / `Changed` / `Fixed` / `Removed`), written for the people who run Tidemark in plain words. Refactors, tests and CI need no entry. Extension API changes get an "For extensions:" line.
- Cutting a release is the maintainer's job and needs the user's go-ahead: PR `develop` → `main` with `VERSION` and the changelog heading set, merge commit, tag `vX.Y.Z` on `main`, then tag and deploy Cloud.
- Release type decides the follow-ups: **major** (new features): update the marketing site and docs, decide per feature whether it is Pro or free on Cloud and say why, write a blog post, draft a post per social profile. **Minor fix/behaviour change:** update site/docs only where they are now wrong. **Security fix:** also a social alert. Always show drafts and wait for a yes.
- The public roadmap lives on the community forum (community.hellotidemark.com, category Ideas and feedback; board at /boards/roadmap/1). Keep each feature's status tag current: In progress when started, Shipped when released.

## Differences between the other repos

- `tidemark-cloud` (private Composer package `tidemark/cloud`): same PHP/Pint/test rules, namespace `Tidemark\Cloud`, tests run inside a core checkout, PRs go into `main`, releases are tags. It reuses core's CSS and `ui.js`; fix UI there only when it is Cloud-specific.
- `tidemark-site` (Astro): no Pint or PHP; pushes to `main` deploy to Vercel (do not push to `main` without the user's go-ahead). Facts that repeat live in `src/data/site.ts`.
