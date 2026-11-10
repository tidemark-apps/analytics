<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\Site;
use App\Models\User;
use App\Support\SecondFactor;
use App\Updates\Updater;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string', 'code' => 'nullable|string', 'method' => 'nullable|string|in:totp,email,recovery,passkey', 'passkey' => 'nullable|array']);
        $key = 'login:'.strtolower($data['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 8)) {
            throw ValidationException::withMessages(['email' => 'Too many attempts. Try again in a minute.']);
        }

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }
        if ($user->hasTwoFactor()) {
            if (empty($data['code']) && empty($data['passkey'])) {
                return response()->json(['two_factor' => true, 'methods' => SecondFactor::methods($user)], 202);
            }
            if (! SecondFactor::verify($user, $data['method'] ?? null, $data['code'] ?? null, $data['passkey'] ?? null)) {
                RateLimiter::hit($key, 60);
                throw ValidationException::withMessages(['code' => 'Invalid authentication code.']);
            }
        }
        RateLimiter::clear($key);
        Auth::guard('web')->login($user, (bool) $request->boolean('remember'));
        $request->session()->regenerate();

        return ['user' => $this->present($user)];
    }

    public function register(Request $request)
    {
        abort_unless(config('tidemark.registration'), 403, 'Registration is disabled.');
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);
        $user = User::create($data);
        Organization::personalFor($user);
        event(new Registered($user));
        if (config('tidemark.verify_email')) {
            $user->sendEmailVerificationNotification();
        }
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['user' => $this->present($user)], 201);
    }

    /** Always answers the same way, so it can't be used to find out which emails have accounts. */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        if (self::mailConfigured()) {
            PasswordBroker::sendResetLink($data);
        }

        return ['ok' => true];
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate(['token' => 'required|string', 'email' => 'required|email', 'password' => ['required', 'confirmed', Password::min(8)]]);
        $status = PasswordBroker::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            event(new PasswordReset($user));
        });
        if ($status !== PasswordBroker::PasswordReset) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired. Request a new one.']);
        }

        return ['ok' => true];
    }

    /** The link from the verification email (signed, so it works from any device). */
    public function verifyEmail(Request $request, string $id, string $hash)
    {
        $user = User::find($id);
        if ($user && hash_equals($hash, sha1($user->getEmailForVerification())) && ! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return redirect('/sites?verified=1');
    }

    public function resendVerification(Request $request)
    {
        $user = $request->user();
        if (config('tidemark.verify_email') && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return ['ok' => true];
    }

    public static function mailConfigured(): bool
    {
        return ! in_array(config('mail.default'), ['log', 'array', null], true);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ['ok' => true];
    }

    public function me(Request $request)
    {
        $user = $this->present($request->user());
        if ($user['is_admin'] && config('tidemark.updater')) {
            $updater = app(Updater::class);
            $user['update'] = $updater->availableUpdate();
            // refresh the daily check after the response has been sent, so it never slows the page down
            app()->terminating(fn () => $updater->refreshIfStale(6));
        }

        return ['user' => $user, 'config' => [
            'mode' => config('tidemark.mode'),
            'script_base' => url('/js'),
            'event_url' => url('/api/event'),
        ]];
    }

    public function config()
    {
        return ['registration' => (bool) config('tidemark.registration'), 'mode' => config('tidemark.mode'), 'name' => config('app.name'), 'password_reset' => self::mailConfigured(), 'invites' => Invitation::enabled()];
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|email|max:255|unique:users,email,'.$request->user()->id.',id',
            'timezone' => ['sometimes', 'string', fn ($a, $v, $fail) => in_array($v, \DateTimeZone::listIdentifiers(), true) || $fail('Unknown timezone')],
            'locale' => 'sometimes|string|max:12',
        ]);
        $request->user()->update($data);

        return ['user' => $this->present($request->user()->fresh())];
    }

    public function password(Request $request)
    {
        $data = $request->validate(['current_password' => 'required|string', 'password' => ['required', 'confirmed', Password::min(8)]]);
        if (! Hash::check($data['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages(['current_password' => 'Current password is incorrect.']);
        }
        $request->user()->update(['password' => $data['password']]);

        return ['ok' => true];
    }

    public function keys(Request $request)
    {
        return ['data' => $request->user()->apiKeys()->latest()->get()];
    }

    public function createKey(Request $request)
    {
        $data = $request->validate(['name' => 'required|string|max:100', 'scope' => ['sometimes', Rule::in(ApiKey::SCOPES)]]);
        [$key, $plain] = ApiKey::issue($request->user(), $data['name'], $data['scope'] ?? 'full');

        return response()->json(['data' => $key, 'token' => $plain], 201);
    }

    public function deleteKey(Request $request, string $id)
    {
        $request->user()->apiKeys()->whereKey($id)->delete();

        return ['ok' => true];
    }

    private function present(User $u): array
    {
        Organization::personalFor($u); // everyone has a Personal organization, including people who signed up before they existed

        return [
            'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'avatar_url' => $u->avatarUrl(), 'is_admin' => $u->is_admin,
            'timezone' => $u->timezone, 'locale' => $u->locale, 'two_factor' => $u->hasTwoFactor(),
            'email_verified' => $u->hasVerifiedEmail(), 'verification_required' => (bool) config('tidemark.verify_email'),
            'updater_enabled' => (bool) config('tidemark.updater'),
            'can_rollup' => Site::rollupsAllowedFor($u),
            // organizations this person owns or administers, for the choice when adding a site or a team
            'organizations' => Organization::whereIn('id', Organization::idsFor($u))->when(! config('tidemark.organizations'), fn ($q) => $q->where('personal', true))->orderByDesc('personal')->orderBy('name')->get()->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'personal' => $o->personal, 'logo_url' => $o->logoUrl(), 'role' => $o->owner_id === $u->id ? 'owner' : 'admin', 'can_rollup' => Site::rollupsAllowedFor($u, $o)])->values(),
            // sites of other people's organizations this person can open (shown under "Shared with me")
            'shared_sites' => Site::where('kind', '!=', 'rollup')->memberOf($u)->where(fn ($q) => $q->whereNull('organization_id')->orWhereNotIn('organization_id', Organization::idsFor($u)))->exists(),
        ];
    }
}
