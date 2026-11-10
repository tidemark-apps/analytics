<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * The plan of an install that is run for someone else (a hosting service), read from the JSON file named by `TIDEMARK_PLAN_FILE`.
 * The host rewrites the file to change the plan or to pause the install, and the change applies on the next request: nothing restarts.
 * Every key is optional and a missing one means "no limit", so a file that is empty or unreadable never locks anyone out.
 *
 * {"name":"Pro","suspended":false,"expires_at":null,"sites":0,"events_per_month":0,"hard_limit":true,
 *  "features":{"alerts":true,"branding":true,"funnels":true,"revenue":true,"segments":true,"journeys":true,"campaign_links":true,"rollups":true},
 *  "enforce_pii_scrubbing":false}
 *
 * `expires_at` (an ISO 8601 date or time) ends a trial: from then on the install records nothing and adds no sites, exactly as if it were
 * suspended, and what was collected stays readable. A missing or unreadable value means it never expires.
 * `sites` and `events_per_month` of 0 mean unlimited. `hard_limit` stops recording at `events_per_month`; without it the allowance
 * is only reported (see `tidemark:usage`), so a host can bill for what goes over.
 */
class PlanFile
{
    public const FEATURES = ['alerts', 'branding', 'funnels', 'revenue', 'segments', 'journeys', 'campaign_links', 'rollups'];

    /** @var array{0:string,1:int,2:array<string,mixed>}|null path, modified time, contents */
    private static ?array $loaded = null;

    /** @return array<string,mixed> */
    public static function read(): array
    {
        $path = (string) config('tidemark.plan_file');
        if ($path === '') {
            return [];
        }
        clearstatcache(true, $path);
        $modified = @filemtime($path) ?: 0;
        if (self::$loaded && self::$loaded[0] === $path && self::$loaded[1] === $modified) {
            return self::$loaded[2];
        }
        $plan = self::parse($path);
        self::$loaded = [$path, $modified, $plan];

        return $plan;
    }

    /** @return array<string,mixed> */
    private static function parse(string $path): array
    {
        $json = @file_get_contents($path);
        $plan = $json === false ? null : json_decode($json, true);
        if (! is_array($plan)) {
            Log::warning("The plan file {$path} is missing or is not valid JSON; no limits are applied.");

            return [];
        }

        return $plan;
    }

    public static function name(): string
    {
        return (string) (self::read()['name'] ?? '');
    }

    public static function suspended(): bool
    {
        return (bool) (self::read()['suspended'] ?? false);
    }

    /** When the plan ends (a trial), or null for one that never does. */
    public static function expiresAt(): ?\DateTimeImmutable
    {
        $value = self::read()['expires_at'] ?? null;
        if (! is_string($value) || $value === '') {
            return null;
        }
        try {
            return new \DateTimeImmutable($value, new \DateTimeZone('UTC'));
        } catch (\Exception) {
            return null;
        }
    }

    public static function expired(): bool
    {
        $end = self::expiresAt();

        return $end !== null && $end <= new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /** True while recording and new sites are refused outright: the host paused the install, or its trial ran out. */
    public static function stopped(): bool
    {
        return self::suspended() || self::expired();
    }

    /** The most sites the install may hold, or 0 for no limit. */
    public static function sites(): int
    {
        return max(0, (int) (self::read()['sites'] ?? 0));
    }

    /** The events one calendar month (UTC) includes, or 0 for no limit. */
    public static function eventsPerMonth(): int
    {
        return max(0, (int) (self::read()['events_per_month'] ?? 0));
    }

    public static function hardLimit(): bool
    {
        return (bool) (self::read()['hard_limit'] ?? false);
    }

    public static function feature(string $name): bool
    {
        return (bool) (self::read()['features'][$name] ?? true);
    }

    public static function enforcesPiiScrubbing(): bool
    {
        return (bool) (self::read()['enforce_pii_scrubbing'] ?? false);
    }

    /** For tests and for a host that rewrites the file inside one process. */
    public static function forget(): void
    {
        self::$loaded = null;
    }
}
