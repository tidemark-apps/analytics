<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Rollups: a read-only dashboard that adds up the data of several sites of one organization. A rollup is a site of its own (kind `rollup`) with
 * its own goals, funnels, segments and timezone, so the dashboard works as it does for any site; only the data comes from its members.
 */
class RollupController extends Controller
{
    /** The sites an organization's rollup could add up: the ones the organization holds, for someone who owns or administers it. */
    public function candidates(Request $r)
    {
        $org = $this->organizationFor($r->user(), $r->query('organization'));

        return ['data' => Site::real()->where('organization_id', $org->id)->orderBy('domain')->get(['id', 'domain', 'timezone'])->all()];
    }

    public function store(Request $r)
    {
        $user = $r->user();
        $data = $r->validate(['name' => 'required|string|max:63', 'organization' => 'nullable|string', 'timezone' => 'nullable|string|max:64', 'all' => 'sometimes|boolean', 'sites' => 'sometimes|array|max:500', 'sites.*' => 'string']);
        $org = $this->organizationFor($user, $data['organization'] ?? null);
        if (! Site::rollupsAllowedFor($user, $org)) {
            return response()->json(['error' => 'rollups_unavailable', 'message' => 'Rollups are included with Pro.'], 403);
        }
        $name = strtolower(trim($data['name']));
        if (! preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/', $name)) {
            throw ValidationException::withMessages(['name' => 'Use letters, numbers and hyphens only, for example all-sites.']);
        }
        if (in_array($name, Site::reservedNames(), true) || Site::where('domain', $name)->exists()) {
            throw ValidationException::withMessages(['name' => 'That name is already taken.']);
        }
        $all = (bool) ($data['all'] ?? false);
        $members = $all ? collect() : $this->membersFor($org, (array) ($data['sites'] ?? []));
        if (! $all && $members->isEmpty()) {
            throw ValidationException::withMessages(['sites' => 'Choose at least one site, or include all of the organization\'s sites.']);
        }
        $timezone = $data['timezone'] ?? null;
        if (! $timezone || ! in_array($timezone, \DateTimeZone::listIdentifiers(), true)) {
            $timezone = $this->commonTimezone($all ? Site::real()->where('organization_id', $org->id)->get() : $members);
        }

        $rollup = DB::transaction(function () use ($name, $timezone, $all, $members, $org) {
            $rollup = Site::create(['kind' => 'rollup', 'domain' => $name, 'timezone' => $timezone, 'rollup_all' => $all, 'organization_id' => $org->id]);
            // owned by the organization's owner, like its sites, so it stays with the organization
            $rollup->members()->attach($org->owner_id, ['role' => 'owner', 'id' => (string) Str::uuid()]);
            $rollup->rollupMembers()->sync($members->pluck('id')->all());

            return $rollup;
        });

        return response()->json(['data' => app(SiteController::class)->present($rollup, $user)], 201);
    }

    /** Change which sites a rollup adds up. */
    public function update(Request $r)
    {
        /** @var Site $rollup */
        $rollup = $r->attributes->get('site');
        abort_unless($rollup->isRollup(), 404, 'This site is not a rollup.');
        $data = $r->validate(['all' => 'sometimes|boolean', 'sites' => 'sometimes|array|max:500', 'sites.*' => 'string']);
        $org = $rollup->organization ?? abort(422, 'This rollup is not in an organization yet.');
        $all = (bool) ($data['all'] ?? $rollup->rollup_all);
        $members = $all ? collect() : $this->membersFor($org, array_key_exists('sites', $data) ? $data['sites'] : $rollup->rollupMembers()->pluck('domain')->all());
        if (! $all && $members->isEmpty()) {
            throw ValidationException::withMessages(['sites' => 'Choose at least one site, or include all of your sites.']);
        }
        $rollup->update(['rollup_all' => $all]);
        $rollup->rollupMembers()->sync($members->pluck('id')->all());

        return ['data' => app(SiteController::class)->present($rollup->fresh(), $r->user(), $r->attributes->get('role'))];
    }

    /** The organization a rollup is made in: one the person owns or administers (their Personal one by default). */
    private function organizationFor($user, ?string $id): Organization
    {
        $org = $id && config('tidemark.organizations') ? Organization::whereKey($id)->whereIn('id', Organization::idsFor($user))->first() : Organization::personalFor($user);
        if (! $org) {
            throw ValidationException::withMessages(['organization' => 'You are not an owner or admin of that organization.']);
        }

        return $org;
    }

    /** @param array<int,string> $domains */
    private function membersFor(Organization $org, array $domains)
    {
        $domains = array_map(fn ($d) => strtolower(trim($d)), $domains);

        return Site::real()->where('organization_id', $org->id)->whereIn('domain', $domains)->get(['id', 'domain', 'timezone']);
    }

    /** The timezone most of the sites use, like Plausible does for its consolidated view. */
    private function commonTimezone($sites): string
    {
        $counts = $sites->pluck('timezone')->filter()->countBy()->sortDesc();

        return $counts->keys()->first() ?? 'UTC';
    }
}
