<?php

namespace App\Support;

use App\Contracts\AllowsAlerts;
use App\Contracts\AllowsBranding;
use App\Contracts\AllowsCampaignLinks;
use App\Contracts\AllowsConversionReports;
use App\Contracts\AllowsExploration;
use App\Contracts\AllowsRollups;
use App\Contracts\EnforcesPiiScrubbing;
use App\Contracts\Entitlements;
use App\Contracts\LimitsImportedHistory;
use App\Models\Site;
use App\Models\User;

/**
 * Entitlements for an install that is run for someone else: what the plan file says ({@see PlanFile}), nothing about who pays or how.
 * The host decides the plan and rewrites the file; this only enforces it.
 */
class ConfiguredEntitlements implements AllowsAlerts, AllowsBranding, AllowsCampaignLinks, AllowsConversionReports, AllowsExploration, AllowsRollups, EnforcesPiiScrubbing, Entitlements, LimitsImportedHistory
{
    public function canCreateSite(User $user): true|string
    {
        if (PlanFile::expired()) {
            return 'Your trial has ended. Choose a plan to add sites.';
        }
        if (PlanFile::suspended()) {
            return 'This account is suspended. Contact support to restore it.';
        }
        $limit = PlanFile::sites();
        if ($limit > 0 && Site::real()->count() >= $limit) {
            return "Your plan includes {$limit} site".($limit === 1 ? '' : 's').'.';
        }

        return true;
    }

    public function allowsRecording(array $site): bool
    {
        if (PlanFile::stopped()) {
            return false;
        }
        $allowed = PlanFile::eventsPerMonth();
        if ($allowed === 0 || ! PlanFile::hardLimit()) {
            return true;
        }
        // a measurement such as scroll depth is not an event the plan counts: it is recorded while there is room, and never counted
        if (($site['interactive'] ?? true) === false) {
            return MonthlyEvents::current() < $allowed;
        }
        if (MonthlyEvents::hit() <= $allowed) {
            return true;
        }
        MonthlyEvents::undo();

        return false;
    }

    public function importCutoff(Site $site): ?\DateTimeInterface
    {
        $days = (int) config('tidemark.retention_days');

        return $days > 0 ? now()->subDays($days) : null;
    }

    public function allowsAlerts(Site $site): bool
    {
        return PlanFile::feature('alerts');
    }

    public function allowsBranding(Site $site): bool
    {
        return PlanFile::feature('branding');
    }

    public function allowsCampaignLinks(Site $site): bool
    {
        return PlanFile::feature('campaign_links');
    }

    public function allowsFunnels(Site $site): bool
    {
        return PlanFile::feature('funnels');
    }

    public function allowsRevenue(Site $site): bool
    {
        return PlanFile::feature('revenue');
    }

    public function allowsSegments(Site $site): bool
    {
        return PlanFile::feature('segments');
    }

    public function allowsJourneys(Site $site): bool
    {
        return PlanFile::feature('journeys');
    }

    public function allowsRollups(User $user): bool
    {
        return PlanFile::feature('rollups');
    }

    public function enforcesPiiScrubbing(): bool
    {
        return PlanFile::enforcesPiiScrubbing();
    }
}
