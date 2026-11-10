<?php

namespace App\Http\Controllers\Api;

use App\Analytics\Support\FilteredHits;
use App\Analytics\Support\PiiMasks;
use App\Analytics\Support\Sql;
use App\Http\Controllers\Controller;
use App\Mail\InviteMail;
use App\Models\Funnel;
use App\Models\FunnelStep;
use App\Models\Goal;
use App\Models\Invitation;
use App\Models\SharedLink;
use App\Models\ShieldRule;
use App\Models\Site;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Per-site settings: goals, shared links, shields and people. */
class SettingsController extends Controller
{
    public function goals(Request $r)
    {
        return ['data' => $r->attributes->get('site')->goals()->orderBy('created_at')->get()];
    }

    public function createGoal(Request $r)
    {
        $site = $r->attributes->get('site');
        $data = $r->validate(['type' => ['required', Rule::in(['event', 'page'])], 'value' => 'required|string|max:255', 'currency' => ['nullable', 'regex:/^[A-Za-z]{3}$/']]);
        $value = trim($data['value']);
        if ($data['type'] === 'page' && ! str_starts_with($value, '/')) {
            $value = '/'.$value;
        }
        if (Goal::where('site_id', $site->id)->where('type', $data['type'])->where('value', $value)->exists()) {
            throw ValidationException::withMessages(['value' => 'That goal already exists.']);
        }
        $currency = $this->currencyFor($site, $data['type'], $data['currency'] ?? null);

        return response()->json(['data' => Goal::create(['site_id' => $site->id, 'type' => $data['type'], 'value' => $value, 'currency' => $currency])], 201);
    }

    /** Turn revenue reporting on, change its currency, or turn it off (null) for a custom-event goal. */
    public function updateGoal(Request $r, string $site, string $goal)
    {
        $site = $r->attributes->get('site');
        $model = $site->goals()->findOrFail($goal);
        $data = $r->validate(['currency' => ['present', 'nullable', 'regex:/^[A-Za-z]{3}$/']]);
        $currency = $this->currencyFor($site, $model->type, $data['currency']);
        if ($currency !== $model->currency && $model->type === 'event') {
            // amounts converted into the previous currency no longer apply
            Sql::connection()->table('events')->where('site_id', $site->id)->where('name', $model->value)->update(['revenue_reporting' => null]);
        }
        $model->update(['currency' => $currency]);

        return ['data' => $model->fresh()];
    }

    private function currencyFor($site, string $type, ?string $currency): ?string
    {
        if ($currency === null || $currency === '') {
            return null;
        }
        if ($type !== 'event') {
            throw ValidationException::withMessages(['currency' => 'Only custom events can report revenue.']);
        }
        if (! $site->revenueAllowed()) {
            throw ValidationException::withMessages(['currency' => 'Revenue reporting is not available on this plan.']);
        }

        return strtoupper($currency);
    }

    public function deleteGoal(Request $r, string $site, string $goal)
    {
        $site = $r->attributes->get('site');
        $inFunnel = FunnelStep::where('goal_id', $goal)->join('funnels', 'funnels.id', '=', 'funnel_steps.funnel_id')->where('funnels.site_id', $site->id)->value('funnels.name');
        if ($inFunnel) {
            throw ValidationException::withMessages(['goal' => "This goal is a step in the \"{$inFunnel}\" funnel. Remove it from the funnel first."]);
        }
        $site->goals()->whereKey($goal)->delete();

        return ['ok' => true];
    }

    public function funnels(Request $r)
    {
        $funnels = $r->attributes->get('site')->funnels()->with('steps')->orderBy('created_at')->get();

        return ['data' => $funnels->map(fn ($f) => ['id' => $f->id, 'name' => $f->name, 'steps' => $f->steps->map(fn ($s) => ['goal_id' => $s->goal_id])->all()])->all()];
    }

    public function createFunnel(Request $r)
    {
        $site = $r->attributes->get('site');
        $funnel = DB::transaction(fn () => $this->saveFunnel($site, new Funnel(['site_id' => $site->id]), $this->funnelData($r, $site)));

        return response()->json(['data' => $funnel], 201);
    }

    public function updateFunnel(Request $r, string $site, string $funnel)
    {
        $site = $r->attributes->get('site');
        $model = $site->funnels()->findOrFail($funnel);

        return ['data' => DB::transaction(fn () => $this->saveFunnel($site, $model, $this->funnelData($r, $site)))];
    }

    public function deleteFunnel(Request $r, string $site, string $funnel)
    {
        $model = $r->attributes->get('site')->funnels()->findOrFail($funnel);
        FunnelStep::where('funnel_id', $model->id)->delete();
        $model->delete();

        return ['ok' => true];
    }

    /** @return array{name:string,steps:array<int,string>} */
    private function funnelData(Request $r, $site): array
    {
        abort_unless($site->funnelsAllowed(), 403, 'Funnels are not available on this plan.');
        $data = $r->validate(['name' => 'required|string|max:100', 'steps' => 'required|array|min:'.Funnel::MIN_STEPS.'|max:'.Funnel::MAX_STEPS, 'steps.*' => 'required|string']);
        $known = $site->goals()->pluck('id')->all();
        foreach ($data['steps'] as $id) {
            if (! in_array($id, $known, true)) {
                throw ValidationException::withMessages(['steps' => 'Each step must be one of this site\'s goals.']);
            }
        }

        return ['name' => trim($data['name']), 'steps' => array_values($data['steps'])];
    }

    private function saveFunnel($site, Funnel $funnel, array $data): Funnel
    {
        $funnel->fill(['name' => $data['name']])->save();
        FunnelStep::where('funnel_id', $funnel->id)->delete();
        foreach ($data['steps'] as $i => $goalId) {
            FunnelStep::create(['funnel_id' => $funnel->id, 'goal_id' => $goalId, 'position' => $i + 1]);
        }

        return $funnel->load('steps');
    }

    public function sharedLinks(Request $r)
    {
        return ['data' => $r->attributes->get('site')->sharedLinks()->orderBy('created_at')->get()];
    }

    public function createSharedLink(Request $r)
    {
        $site = $r->attributes->get('site');
        $data = $r->validate(['name' => 'required|string|max:100', 'password' => 'nullable|string|min:4|max:100']);
        $link = SharedLink::create([
            'site_id' => $site->id, 'name' => $data['name'], 'slug' => Str::random(24),
            'password_hash' => ! empty($data['password']) ? Hash::make($data['password']) : null,
        ]);

        return response()->json(['data' => $link], 201);
    }

    public function updateSharedLink(Request $r, string $site, string $link)
    {
        $model = $r->attributes->get('site')->sharedLinks()->findOrFail($link);
        $data = $r->validate(['name' => 'sometimes|required|string|max:100', 'password' => 'sometimes|nullable|string|min:4|max:100']);
        if (array_key_exists('name', $data)) {
            $model->name = $data['name'];
        }
        if (array_key_exists('password', $data)) {
            $model->password_hash = $data['password'] ? Hash::make($data['password']) : null;
        }
        $model->save();

        return ['data' => $model];
    }

    public function deleteSharedLink(Request $r, string $site, string $link)
    {
        $r->attributes->get('site')->sharedLinks()->whereKey($link)->delete();

        return ['ok' => true];
    }

    /** How many values were masked in the last 30 days, by kind (never the values). */
    public function piiMasks(Request $request)
    {
        abort_if(Site::piiScrubEnforced(), 404);

        return ['days' => 30, 'results' => PiiMasks::recent($request->attributes->get('site')->id)];
    }

    /** How many hits bot filtering left out in the last 30 days, by reason (never anything about who sent them). */
    public function filtered(Request $request)
    {
        return ['days' => 30, 'results' => FilteredHits::recent($request->attributes->get('site')->id)];
    }

    public function shields(Request $r)
    {
        return ['data' => $r->attributes->get('site')->shields()->orderBy('created_at')->get()];
    }

    public function createShield(Request $r)
    {
        $site = $r->attributes->get('site');
        abort_if($site->isRollup(), 422, 'Shields apply to the sites a rollup adds up, not to the rollup.');
        $data = $r->validate(['type' => ['required', Rule::in(['ip', 'country', 'page', 'hostname'])], 'value' => 'required|string|max:255']);
        $value = trim($data['value']);
        if ($data['type'] === 'country') {
            $value = strtoupper($value);
            if (! preg_match('/^[A-Z]{2}$/', $value)) {
                throw ValidationException::withMessages(['value' => 'Use a two-letter country code, e.g. US.']);
            }
        }
        if ($data['type'] === 'ip' && ! preg_match('/^[0-9a-fA-F:.*\/]+$/', $value)) {
            throw ValidationException::withMessages(['value' => 'Enter an IP address, a CIDR range or a pattern like 192.168.*.']);
        }
        if (count($site->shields) >= 500) {
            throw ValidationException::withMessages(['value' => 'Too many rules.']);
        }
        $rule = ShieldRule::firstOrCreate(['site_id' => $site->id, 'type' => $data['type'], 'value' => $value]);
        Cache::forget('tdm:site:'.$site->domain);

        return response()->json(['data' => $rule], 201);
    }

    public function deleteShield(Request $r, string $site, string $rule)
    {
        $s = $r->attributes->get('site');
        $s->shields()->whereKey($rule)->delete();
        Cache::forget('tdm:site:'.$s->domain);

        return ['ok' => true];
    }

    public function people(Request $r)
    {
        $site = $r->attributes->get('site');
        Invitation::where('expires_at', '<', now())->where('site_id', $site->id)->delete();

        return [
            'data' => $site->members()->get()->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'avatar_url' => $u->avatarUrl(), 'role' => $u->pivot->role]),
            'invites' => Invitation::where('site_id', $site->id)->orderBy('created_at')->get()->map(fn ($i) => ['id' => $i->id, 'email' => $i->email, 'role' => $i->role, 'expires_at' => $i->expires_at->toIso8601String()]),
            'invites_enabled' => Invitation::enabled(),
            'teams' => $site->teams()->withCount('members')->with(['members' => fn ($q) => $q->orderBy('name')->limit(25)])->orderBy('name')->get()->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'role' => $t->pivot->role, 'members' => $t->members_count, 'member_names' => $t->members->pluck('name')->values()]),
            // people who administer the whole organization: admins here without being listed above
            'organization_admins' => ! config('tidemark.organizations') || $site->isRollup() || ! $site->organization ? [] : $site->organization->admins()->orderBy('name')->get()->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'avatar_url' => $u->avatarUrl()]),
            // only the site's owner decides which of their teams it is shared with
            'available_teams' => config('tidemark.organizations') && ($r->attributes->get('role') === 'owner' || $site->isOrganizationAdmin($r->user())) && ! $site->isRollup() && $site->organization_id
                ? Team::where('organization_id', $site->organization_id)->whereNotIn('id', $site->teams()->pluck('teams.id'))->withCount('members')->orderBy('name')->get()->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'members' => $t->members_count])->values() : [],
        ];
    }

    /**
     * Give a person access. Someone who already has an account is added straight away; an address without one gets an e-mail
     * invitation when invitations are enabled (otherwise an administrator has to create the account first).
     */
    public function addPerson(Request $r)
    {
        $site = $r->attributes->get('site');
        abort_if($site->isRollup(), 422, 'A rollup is private to its owner. Share it with a shared link instead.');
        $data = $r->validate(['email' => 'required|email', 'role' => ['required', Rule::in(['admin', 'viewer'])]]);
        $email = strtolower(trim($data['email']));
        $inviter = $r->user();
        $user = User::whereRaw('lower(email) = ?', [$email])->first();
        if (! $user) {
            if (! Invitation::enabled()) {
                throw ValidationException::withMessages(['email' => 'No account with that e-mail. Ask an administrator to create one first.']);
            }
            Invitation::guardAbuse($inviter);
            $invite = Invitation::issue($email, $inviter, $site, $data['role']);
            Mail::to($email)->send(new InviteMail($site, $inviter, $data['role'], $invite));
            Invitation::countSent($inviter);

            return response()->json(['ok' => true, 'invited' => true], 201);
        }
        if ($site->members()->where('users.id', $user->id)->exists()) {
            throw ValidationException::withMessages(['email' => 'This person already has access.']);
        }
        $site->members()->attach($user->id, ['role' => $data['role'], 'id' => (string) Str::uuid()]);
        Invitation::where('email', $email)->where('site_id', $site->id)->delete();
        if (AuthController::mailConfigured()) {
            Mail::to($user->email)->send(new InviteMail($site, $inviter, $data['role']));
        }

        return response()->json(['ok' => true], 201);
    }

    public function resendInvite(Request $r, string $site, string $invite)
    {
        $s = $r->attributes->get('site');
        $old = Invitation::where('site_id', $s->id)->whereKey($invite)->firstOrFail();
        abort_unless(Invitation::enabled(), 422, 'Invitations are turned off.');
        Invitation::guardAbuse($r->user());
        $new = Invitation::issue($old->email, $r->user(), $s, $old->role);
        Mail::to($new->email)->send(new InviteMail($s, $r->user(), $new->role, $new));
        Invitation::countSent($r->user());

        return ['ok' => true];
    }

    public function revokeInvite(Request $r, string $site, string $invite)
    {
        Invitation::where('site_id', $r->attributes->get('site')->id)->whereKey($invite)->delete();

        return ['ok' => true];
    }

    /** Share the site with one of the owner's teams, as viewers or as admins. */
    public function addTeam(Request $r)
    {
        $site = $r->attributes->get('site');
        abort_if($site->isRollup(), 422, 'A rollup is private to its owner. Share it with a shared link instead.');
        $data = $r->validate(['team_id' => 'required|string', 'role' => ['required', Rule::in(['admin', 'viewer'])]]);
        $team = Team::where('organization_id', $site->organization_id)->find($data['team_id']);
        if (! $team) {
            throw ValidationException::withMessages(['team_id' => 'Choose one of the owner\'s teams.']);
        }
        if ($site->teams()->where('teams.id', $team->id)->exists()) {
            throw ValidationException::withMessages(['team_id' => 'This team already has access.']);
        }
        $site->teams()->attach($team->id, ['role' => $data['role'], 'id' => (string) Str::uuid()]);

        return response()->json(['ok' => true], 201);
    }

    public function updateTeam(Request $r, string $site, string $team)
    {
        $data = $r->validate(['role' => ['required', Rule::in(['admin', 'viewer'])]]);
        $r->attributes->get('site')->teams()->updateExistingPivot($team, ['role' => $data['role']]);

        return ['ok' => true];
    }

    public function removeTeam(Request $r, string $site, string $team)
    {
        $r->attributes->get('site')->teams()->detach($team);

        return ['ok' => true];
    }

    public function updatePerson(Request $r, string $site, string $user)
    {
        $s = $r->attributes->get('site');
        $data = $r->validate(['role' => ['required', Rule::in(['admin', 'viewer'])]]);
        abort_if($s->members()->where('users.id', $user)->first()?->pivot->role === 'owner', 422, 'The owner role cannot be changed.');
        $s->members()->updateExistingPivot($user, ['role' => $data['role']]);

        return ['ok' => true];
    }

    public function removePerson(Request $r, string $site, string $user)
    {
        $s = $r->attributes->get('site');
        abort_if($s->members()->where('users.id', $user)->first()?->pivot->role === 'owner', 422, 'The owner cannot be removed.');
        $s->members()->detach($user);

        return ['ok' => true];
    }
}
