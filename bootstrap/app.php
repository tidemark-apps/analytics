<?php

use App\Http\Middleware\ApiAuth;
use App\Http\Middleware\CollectCors;
use App\Http\Middleware\EnsureInstalled;
use App\Http\Middleware\RequireOrganizations;
use App\Http\Middleware\RunPendingUpdate;
use App\Http\Middleware\SiteAccess;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

// First run on shared hosting (no SSH): create .env from the template and a fresh APP_KEY.
$root = dirname(__DIR__);
if (! file_exists($root.'/.env') && file_exists($root.'/.env.example') && PHP_SAPI !== 'cli') {
    $env = file_get_contents($root.'/.env.example');
    $env = preg_replace('/^APP_KEY=.*$/m', 'APP_KEY=base64:'.base64_encode(random_bytes(32)), $env);
    @file_put_contents($root.'/.env', $env);
}

return Application::configure(basePath: $root)
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')->group(base_path('routes/collect.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'api.auth' => ApiAuth::class,
            'site' => SiteAccess::class,
            'installed' => EnsureInstalled::class,
            'organizations' => RequireOrganizations::class,
            'cors.collect' => CollectCors::class,
        ]);
        // The JSON API authenticates with Bearer keys or the session cookie and has its own CSRF guard (see ApiAuth).
        $middleware->api(prepend: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
        ]);
        $middleware->validateCsrfTokens(except: ['reports/unsubscribe/*']);
        $middleware->trustProxies(at: '*');
        $middleware->prepend(RunPendingUpdate::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
