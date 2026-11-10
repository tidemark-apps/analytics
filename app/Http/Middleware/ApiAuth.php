<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use App\Support\SupportGuard;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates API calls via either a Bearer API key (stateless) or the browser session.
 * Session-authenticated writes must carry X-Requested-With so cross-site forms cannot trigger them (CSRF).
 */
class ApiAuth
{
    public function handle(Request $request, Closure $next, string $mode = 'required'): Response
    {
        if ($token = $request->bearerToken()) {
            $key = ApiKey::findByToken($token);
            if (! $key) {
                return response()->json(['error' => 'Invalid API key'], 401);
            }
            if (! $key->allows($request)) {
                return response()->json(['error' => 'This API key is read-only. It can read statistics through the Stats API and MCP, nothing else.'], 403);
            }
            if (! $key->last_used_at || $key->last_used_at->lt(now()->subMinutes(5))) {
                $key->forceFill(['last_used_at' => now()])->save();
            }
            Auth::setUser($key->user);
            $request->attributes->set('via_api_key', true);

            return $next($request);
        }

        if (! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $site = $request->headers->get('Sec-Fetch-Site');
            if ($request->headers->get('X-Requested-With') !== 'XMLHttpRequest' || ($site && ! in_array($site, ['same-origin', 'none'], true))) {
                return response()->json(['error' => 'CSRF check failed'], 419);
            }
        }

        if (Auth::guard('web')->check()) {
            if ($refusal = SupportGuard::refuse($request)) {
                return $refusal;
            }
            Auth::shouldUse('web');
        } elseif ($mode === 'required') {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        return $next($request);
    }
}
