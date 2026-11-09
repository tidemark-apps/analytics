<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Install {{ config('app.name') }}</title>
    <meta name="robots" content="noindex">
    <link rel="icon" href="{{ asset('assets/favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon.ico') }}" sizes="32x32">
    <link rel="apple-touch-icon" href="{{ asset('assets/apple-touch-icon.png') }}">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
    <link rel="preload" href="{{ asset('assets/fonts/geist-variable.woff2') }}" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="{{ asset('assets/app.css') }}?v={{ @filemtime(public_path('assets/app.css')) }}">
</head>
<body class="auth-body">
<a class="skip" href="#main">Skip to the form</a>
<main class="auth-card wide" id="main" tabindex="-1">
    <picture><source srcset="{{ asset('assets/logo/tidemark-horizontal-dark.svg') }}" media="(prefers-color-scheme: dark)"><img src="{{ asset('assets/logo/tidemark-horizontal.svg') }}" alt="Tidemark Analytics" height="38" style="height:38px;width:auto"></picture>
    <div>
        <h1>Let's get you set up</h1>
        <p class="auth-sub">Two minutes: check the server, connect a database, create your admin account.</p>
    </div>

    <section class="install-sec" aria-labelledby="server-check">
    <h2 id="server-check">Server check</h2>
    <ul class="checks">
        @foreach ($requirements as $label => $ok)
            <li class="{{ $ok ? 'ok' : 'bad' }}"><span><svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="{{ asset('assets/icons.svg') }}#{{ $ok ? 'check' : 'x' }}"/></svg></span> {{ $label }}</li>
        @endforeach
    </ul>
    </section>

    @if ($errors->any())
        <div class="alert" role="alert">{{ $errors->first() }}</div>
    @endif

    <form method="post" action="{{ url('/install') }}" class="stack" x-data>
        @csrf
        <section class="install-sec stack" aria-labelledby="db-h">
        <h2 id="db-h">Database</h2>
        <label>Driver
            <select name="driver" id="driver" onchange="document.getElementById('dbfields').style.display = this.value === 'sqlite' ? 'none' : 'grid'">
                <option value="sqlite" @selected(old('driver', 'sqlite') === 'sqlite') @disabled(! $drivers['sqlite'])>SQLite (zero setup — great for small sites)</option>
                <option value="mysql" @selected(old('driver') === 'mysql') @disabled(! $drivers['mysql'])>MySQL / MariaDB</option>
                <option value="pgsql" @selected(old('driver') === 'pgsql') @disabled(! $drivers['pgsql'])>PostgreSQL</option>
            </select>
        </label>
        <div id="dbfields" class="grid2" style="display: {{ old('driver', 'sqlite') === 'sqlite' ? 'none' : 'grid' }}">
            <label>Host <input name="db_host" value="{{ old('db_host', 'localhost') }}"></label>
            <label>Port <input name="db_port" value="{{ old('db_port') }}" placeholder="3306 / 5432"></label>
            <label>Database name <input name="db_name" value="{{ old('db_name') }}"></label>
            <label>Username <input name="db_user" value="{{ old('db_user') }}"></label>
            <label class="span2">Password <input type="password" name="db_pass" autocomplete="new-password"></label>
        </div>
        </section>

        <section class="install-sec stack" aria-labelledby="admin-h">
        <h2 id="admin-h">Admin account</h2>
        <div class="grid2">
            <label>Name <input name="name" value="{{ old('name') }}" required autocomplete="name"></label>
            <label>Email <input type="email" name="email" value="{{ old('email') }}" required autocomplete="email"></label>
            <label>Password <input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
            <label>Confirm password <input type="password" name="password_confirmation" minlength="8" required autocomplete="new-password"></label>
        </div>
        <label>Site URL <input name="app_url" value="{{ old('app_url', $appUrl) }}"></label>
        </section>
        @error('password')<div class="alert" role="alert">{{ $message }}</div>@enderror
        @error('email')<div class="alert" role="alert">{{ $message }}</div>@enderror
        <button class="btn primary" type="submit" @disabled(in_array(false, $requirements, true))>Install</button>
    </form>
</main>
</body>
</html>
