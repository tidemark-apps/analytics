<?php

namespace Tests\Feature;

use App\Contracts\Entitlements;
use App\Models\Site;
use App\Models\User;
use App\Support\ConfiguredEntitlements;
use App\Support\DefaultEntitlements;
use App\Support\MonthlyEvents;
use App\Support\PlanFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ConfiguredEntitlementsTest extends TestCase
{
    use RefreshDatabase;

    private const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();
        $this->path = tempnam(sys_get_temp_dir(), 'plan');
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
        Cache::flush();
    }

    protected function tearDown(): void
    {
        @unlink($this->path);
        PlanFile::forget();
        parent::tearDown();
    }

    /** @param array<string,mixed> $plan */
    private function plan(array $plan): void
    {
        file_put_contents($this->path, json_encode($plan));
        touch($this->path, time() + random_int(1, 100000)); // a changed modified time is how the file is noticed
        config(['tidemark.plan_file' => $this->path]);
        PlanFile::forget();
        $this->app->forgetInstance(Entitlements::class);
    }

    private function owner(): User
    {
        $user = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'password']);
        $this->actingAs($user);

        return $user;
    }

    private function send(array $payload = []): void
    {
        $this->call('POST', '/api/event', [], [], [], $this->transformHeadersToServerVars(['Accept-Language' => 'en-US,en;q=0.9', 'User-Agent' => self::CHROME, 'Content-Type' => 'application/json']),
            json_encode($payload + ['n' => 'pageview', 'u' => 'https://example.com/', 'd' => 'example.com', 'w' => 1200]))->assertStatus(202);
    }

    public function test_without_a_plan_file_nothing_is_limited(): void
    {
        $this->assertInstanceOf(DefaultEntitlements::class, app(Entitlements::class));
    }

    public function test_a_plan_file_switches_the_install_to_configured_entitlements(): void
    {
        $this->plan([]);

        $e = app(Entitlements::class);

        $this->assertInstanceOf(ConfiguredEntitlements::class, $e);
        $this->assertTrue($e->allowsAlerts(new Site));
        $this->assertTrue($e->allowsRecording(['id' => 'x', 'domain' => 'example.com', 'owner_id' => null, 'organization_id' => null, 'interactive' => true]));
    }

    public function test_features_the_plan_leaves_out_are_refused_and_the_rest_stay_on(): void
    {
        $this->plan(['features' => ['alerts' => false, 'funnels' => false, 'rollups' => false]]);
        $e = app(Entitlements::class);
        $site = new Site;

        $this->assertFalse($e->allowsAlerts($site));
        $this->assertFalse($e->allowsFunnels($site));
        $this->assertFalse($e->allowsRollups($this->owner()));
        $this->assertTrue($e->allowsRevenue($site));
        $this->assertTrue($e->allowsBranding($site));
        $this->assertTrue($e->allowsCampaignLinks($site));
        $this->assertTrue($e->allowsSegments($site));
        $this->assertTrue($e->allowsJourneys($site));
    }

    public function test_the_site_limit_stops_a_new_site_with_a_message(): void
    {
        $this->plan(['sites' => 1]);
        $this->owner();

        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->postJson('/api/sites', ['domain' => 'second.com'])->assertUnprocessable()->assertJsonPath('errors.domain.0', 'Your plan includes 1 site.');
    }

    public function test_a_paused_install_records_nothing_and_adds_no_sites(): void
    {
        $this->plan([]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->send();
        $this->assertSame(1, DB::table('events')->count());

        $this->plan(['suspended' => true]);

        $this->send();
        $this->assertSame(1, DB::table('events')->count());
        $this->postJson('/api/sites', ['domain' => 'second.com'])->assertUnprocessable();
    }

    public function test_a_trial_that_has_ended_records_nothing_and_adds_no_sites_but_stays_readable(): void
    {
        $this->plan(['name' => 'Trial', 'expires_at' => gmdate('c', time() + 3600)]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->send();
        $this->assertSame(1, DB::table('events')->count());
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', null)->assertJsonPath('user.plan.expires_at', gmdate('Y-m-d\TH:i:s\Z', time() + 3600));

        $this->plan(['name' => 'Trial', 'expires_at' => gmdate('c', time() - 60)]);

        $this->send();
        $this->assertSame(1, DB::table('events')->count());
        $this->postJson('/api/sites', ['domain' => 'second.com'])->assertUnprocessable()->assertJsonPath('errors.domain.0', 'Your trial has ended. Choose a plan to add sites.');
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', 'expired');
        $this->getJson('/api/sites')->assertOk();

        $this->plan(['expires_at' => 'not a date']); // a value that can't be read never locks anyone out
        $this->send();
        $this->assertSame(2, DB::table('events')->count());

        Artisan::call('tidemark:usage', ['--json' => true]);
        $this->plan(['expires_at' => gmdate('c', time() - 60)]);
        Artisan::call('tidemark:usage', ['--json' => true]);
        $this->assertTrue(json_decode(trim(Artisan::output()), true)['expired']);
    }

    public function test_a_hard_limit_stops_recording_at_the_monthly_events_and_still_answers_202(): void
    {
        $this->plan(['events_per_month' => 2, 'hard_limit' => true]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();

        foreach (range(1, 4) as $i) {
            $this->send(['u' => "https://example.com/page-{$i}"]);
        }

        $this->assertSame(2, DB::table('events')->count());
        $this->assertSame(2, MonthlyEvents::current());
    }

    public function test_a_measurement_is_recorded_while_there_is_room_and_never_counted(): void
    {
        $this->plan(['events_per_month' => 2, 'hard_limit' => true]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $measure = fn () => $this->send(['n' => 'Engagement', 'i' => 0, 'p' => ['depth' => 50]]);

        $this->send();
        $measure();
        $this->assertSame(1, MonthlyEvents::current());
        $this->send(['u' => 'https://example.com/two']);
        $measure();

        $this->assertSame(2, MonthlyEvents::current());
        $this->assertSame(3, DB::table('events')->count());
    }

    public function test_an_allowance_without_a_hard_limit_never_stops_recording(): void
    {
        $this->plan(['events_per_month' => 1]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();

        $this->send();
        $this->send(['u' => 'https://example.com/two']);

        $this->assertSame(2, DB::table('events')->count());
    }

    public function test_the_counter_starts_from_the_events_already_recorded_this_month(): void
    {
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->send();
        $this->send(['u' => 'https://example.com/two']);
        Cache::flush();

        $this->plan(['events_per_month' => 3, 'hard_limit' => true]);
        $this->send(['u' => 'https://example.com/three']);
        $this->send(['u' => 'https://example.com/four']);

        $this->assertSame(3, DB::table('events')->count());
    }

    public function test_rewriting_the_file_changes_the_plan_without_a_restart(): void
    {
        $this->plan(['features' => ['alerts' => false]]);
        $this->assertFalse(app(Entitlements::class)->allowsAlerts(new Site));

        file_put_contents($this->path, json_encode(['features' => ['alerts' => true]]));
        touch($this->path, time() + 500000);

        $this->assertTrue(app(Entitlements::class)->allowsAlerts(new Site));
    }

    public function test_a_file_that_is_not_valid_json_limits_nothing(): void
    {
        file_put_contents($this->path, '{not json');
        config(['tidemark.plan_file' => $this->path]);
        PlanFile::forget();
        $this->app->forgetInstance(Entitlements::class);

        $e = app(Entitlements::class);

        $this->assertTrue($e->allowsAlerts(new Site));
        $this->assertTrue($e->allowsRecording(['id' => 'x', 'domain' => 'example.com', 'owner_id' => null, 'organization_id' => null, 'interactive' => true]));
    }

    public function test_pii_masking_can_be_enforced_by_the_plan(): void
    {
        $this->plan(['enforce_pii_scrubbing' => true]);

        $this->assertTrue(app(Entitlements::class)->enforcesPiiScrubbing());
    }

    public function test_the_usage_command_reports_events_and_sites_against_the_plan(): void
    {
        $this->plan(['name' => 'Trial', 'sites' => 2, 'events_per_month' => 100, 'hard_limit' => true]);
        $this->owner();
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->send();

        Artisan::call('tidemark:usage', ['--json' => true]);
        $usage = json_decode(trim(Artisan::output()), true);

        $this->assertSame('Trial', $usage['plan']);
        $this->assertSame(1, $usage['events']);
        $this->assertSame(100, $usage['events_included']);
        $this->assertSame(1, $usage['sites']);
        $this->assertSame(2, $usage['sites_included']);
        $this->assertTrue($usage['hard_limit']);
        $this->assertFalse($usage['suspended']);
        $this->assertSame(1, $usage['users']);
        $this->assertNotNull($usage['last_event_at']);
        $this->assertArrayHasKey('database_bytes', $usage);
        $this->assertArrayHasKey('version', $usage);
    }

    public function test_the_signed_in_person_is_told_when_the_plan_has_stopped_recording(): void
    {
        $this->owner();
        $this->getJson('/api/me')->assertJsonPath('user.plan', null);

        $this->plan(['name' => 'Trial', 'events_per_month' => 1, 'hard_limit' => true]);
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', null);

        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->send();
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', 'limit')->assertJsonPath('user.plan.events_included', 1)
            ->assertJsonPath('user.plan.resumes_on', gmdate('Y-m-d', strtotime('first day of next month')));

        $this->plan(['suspended' => true]);
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', 'paused');

        $this->plan(['events_per_month' => 1]); // an allowance without a hard limit never stops recording
        $this->getJson('/api/me')->assertJsonPath('user.plan.stopped', null);
    }
}
