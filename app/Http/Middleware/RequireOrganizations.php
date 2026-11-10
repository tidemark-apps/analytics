<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Routes that only exist while organizations are turned on (`TIDEMARK_ORGANIZATIONS`); otherwise they do not exist at all. */
class RequireOrganizations
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('tidemark.organizations'), 404);

        return $next($request);
    }
}
