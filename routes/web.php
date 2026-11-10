<?php

use App\Http\Controllers\CampaignRedirectController;
use App\Http\Controllers\HostSignInController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\ReportUnsubscribeController;
use App\Models\Site;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

// Sign-in link from the service that hosts this install (see App\Support\HostToken)
Route::get('/sso', HostSignInController::class)->middleware('throttle:20,1');

// Browser installer (shared hosting)
Route::get('/install', [InstallController::class, 'show']);

// Campaign links: `/l/abc` counts a click and forwards, `/p/abc.gif` counts a view
Route::get('/l/{slug}', [CampaignRedirectController::class, 'link'])->where('slug', '[a-z0-9]{4,16}');
Route::get('/p/{slug}.gif', [CampaignRedirectController::class, 'pixel'])->where('slug', '[a-z0-9]{4,16}');
Route::post('/install', [InstallController::class, 'store']);

// Unsubscribe link in the e-mail reports (the POST is also the one-click unsubscribe of mail apps, so it has no CSRF token)
Route::get('/reports/unsubscribe/{token}', [ReportUnsubscribeController::class, 'show'])->where('token', '[A-Za-z0-9]{40}');
Route::post('/reports/unsubscribe/{token}', [ReportUnsubscribeController::class, 'destroy'])->where('token', '[A-Za-z0-9]{40}');

// Tracking script. Plausible-style variants are selected by file name: script.outbound-links.file-downloads.js. Each site's snippet
// uses its own code instead of "script" (see Site::trackerCode), so no one file name can be blocklisted for every site; script.js keeps working.
Route::get('/js/{file}', function (string $file) {
    return response()->file(public_path('js/script.js'), [
        'Content-Type' => 'application/javascript; charset=utf-8',
        'Cache-Control' => 'public, max-age=3600',
        'Access-Control-Allow-Origin' => '*',
    ]);
})->where('file', '(script|[a-f0-9]{10})(\.[a-z-]+)*\.js')->name('tracker');

// Single-page dashboard shell. A site's dashboard lives at /{domain}, like Plausible.
Route::middleware('installed')->group(function () {
    Route::get('/', fn () => redirect(Auth::check() ? '/sites' : '/login'));
    Route::view('/login', 'app');
    Route::view('/register', 'app');
    Route::view('/sites/{any?}', 'app')->where('any', '.*');
    Route::view('/settings/{any?}', 'app')->where('any', '.*');
    Route::view('/share/{any}', 'app')->where('any', '.*');
    Route::get('/{domain}/{any?}', fn (string $domain) => response()->view('app', [], Site::where('domain', strtolower($domain))->exists() ? 200 : 404))->where('domain', '(?!('.implode('|', array_map(fn ($n) => preg_quote($n, '/'), Site::reservedNames())).')$)[^/]+')->where('any', '.*');
});
