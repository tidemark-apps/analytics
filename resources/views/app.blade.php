<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }}</title>
    <meta name="robots" content="noindex">
    <link rel="icon" href="{{ asset('assets/favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon.ico') }}" sizes="32x32">
    <link rel="apple-touch-icon" href="{{ asset('assets/apple-touch-icon.png') }}">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
    <script>
        (function () { try { var t = localStorage.getItem('tidemark.theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {} })();
        window.SD = {
            base: @json(rtrim(parse_url(url('/'), PHP_URL_PATH) ?: '', '/')),
            origin: @json(rtrim(url('/'), '/')),
            name: @json(config('app.name')),
            registration: @json((bool) config('tidemark.registration')),
            mode: @json(config('tidemark.mode')),
            organizations: @json((bool) config('tidemark.organizations')),
            extensions: @json(array_values(config('tidemark.extensions', []))),
            legal: @json((object) array_filter(config('tidemark.legal', []))),
            brandUrl: @json(config('tidemark.brand_url')),
            icons: @json(@filemtime(public_path('assets/icons.svg'))),
        };
    </script>
    <script type="importmap">@json(['imports' => \App\Support\Assets::importMap()], JSON_UNESCAPED_SLASHES)</script>
    <link rel="preload" href="{{ asset('assets/fonts/geist-variable.woff2') }}" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="{{ asset('assets/app.css') }}?v={{ @filemtime(public_path('assets/app.css')) }}">
</head>
<body>
<div id="root"></div>
<noscript><p style="font-family:system-ui,sans-serif;padding:24px">{{ config('app.name') }} needs JavaScript to render the dashboard.</p></noscript>
<script type="module" src="{{ asset('assets/js/main.js') }}?v={{ @filemtime(public_path('assets/js/main.js')) }}"></script>
</body>
</html>
