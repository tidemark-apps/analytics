<?php

namespace App\Http\Controllers;

use App\Models\SupportSession;
use App\Models\User;
use App\Support\HostToken;
use App\Support\SupportGuard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Where a {@see HostToken} is redeemed: the link from the host's portal, or from a support person opening a session. */
class HostSignInController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $claims = HostToken::redeem((string) $request->query('token'));
        abort_if($claims === null, 403, 'This sign-in link is not valid or has expired.');

        return $claims['kind'] === 'support' ? $this->support($request, $claims) : $this->customer($request, $claims);
    }

    /** @param array<string,mixed> $claims */
    private function customer(Request $request, array $claims): RedirectResponse
    {
        $user = User::where('email', strtolower($claims['email']))->first();
        abort_if($user === null, 404, 'There is no account for this address.');
        $this->signIn($request, $user);

        return redirect('/sites');
    }

    /** @param array<string,mixed> $claims */
    private function support(Request $request, array $claims): RedirectResponse
    {
        abort_unless(config('tidemark.support_access'), 403, 'Support access is turned off for this account.');
        $user = isset($claims['email']) ? User::where('email', strtolower($claims['email']))->first() : User::where('is_admin', true)->oldest()->first();
        abort_if($user === null, 404, 'There is no account to look at.');
        $minutes = max(1, min(HostToken::MAX_SUPPORT_MINUTES, (int) ($claims['minutes'] ?? 30)));
        $session = SupportSession::create([
            'user_id' => $user->id,
            'staff_id' => mb_substr($claims['staff']['id'], 0, 64),
            'staff_name' => mb_substr($claims['staff']['name'], 0, 120),
            'reason' => isset($claims['reason']) ? mb_substr((string) $claims['reason'], 0, 255) : null,
            'ticket' => isset($claims['ticket']) ? mb_substr((string) $claims['ticket'], 0, 120) : null,
            'started_at' => now(),
            'expires_at' => now()->addMinutes($minutes),
        ]);
        $this->signIn($request, $user);
        $request->session()->put(SupportGuard::SESSION_KEY, $session->id);

        return redirect('/sites');
    }

    private function signIn(Request $request, User $user): void
    {
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
    }
}
