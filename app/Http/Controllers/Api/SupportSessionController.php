<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportSession;
use App\Support\SupportGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SupportSessionController extends Controller
{
    /** The times someone from the host looked at this account, newest first, so the owner can see who and why. */
    public function index(Request $request)
    {
        return ['data' => SupportSession::where('user_id', $request->user()->id)->orderByDesc('started_at')->limit(50)->get()->map->present()->all()];
    }

    /** Ends the support session this browser is in and signs it out. */
    public function end(Request $request)
    {
        SupportGuard::current($request)?->end();
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ['ok' => true];
    }
}
