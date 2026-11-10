<?php

namespace App\Support;

use App\Models\SupportSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * While someone from the host is looking at an account (a support session, see HostToken) the session can read everything the account
 * owner can and change nothing, and it stops when its time is up.
 */
class SupportGuard
{
    public const SESSION_KEY = 'support_session_id';

    /** The support session this browser session belongs to, if it is one. */
    public static function current(Request $request): ?SupportSession
    {
        $id = $request->hasSession() ? $request->session()->get(self::SESSION_KEY) : null;

        return $id ? SupportSession::find($id) : null;
    }

    /** A response that refuses the request, or null when it may go on. */
    public static function refuse(Request $request): ?Response
    {
        if (! $request->hasSession() || ! $request->session()->has(self::SESSION_KEY)) {
            return null;
        }
        $session = self::current($request);
        if (! $session || ! $session->isOpen()) {
            $session?->end();
            Auth::guard('web')->logout();
            $request->session()->invalidate();

            return response()->json(['error' => 'This support session has ended.'], 401);
        }
        $ending = $request->is('api/support/end', 'api/auth/logout');
        if (! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true) && ! $ending) {
            return response()->json(['error' => 'This is a support session: it can look at the account but not change anything.'], 403);
        }

        return null;
    }
}
