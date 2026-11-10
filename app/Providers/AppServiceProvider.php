<?php

namespace App\Providers;

use App\Analytics\Ingest\DatabaseSink;
use App\Analytics\Ingest\EventSink;
use App\Analytics\Ingest\QueueSink;
use App\Contracts\Entitlements;
use App\Support\ConfiguredEntitlements;
use App\Support\DefaultEntitlements;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Swap the sink (queue, ClickHouse, Kafka ...) without touching the collector.
        $this->app->bind(EventSink::class, fn () => config('tidemark.ingest') === 'queue' ? new QueueSink : new DatabaseSink);
        // singletonIf: an extension package that bound its own Entitlements earlier wins.
        // A plan file (TIDEMARK_PLAN_FILE) hands the decisions to whoever hosts the install.
        $this->app->singletonIf(Entitlements::class, fn () => config('tidemark.plan_file') ? new ConfiguredEntitlements : new DefaultEntitlements);
    }

    public function boot(): void
    {
        // Reset links open the dashboard's own page (the SPA), not a server-rendered form.
        ResetPassword::createUrlUsing(fn ($user, string $token) => url('/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset())));
    }
}
