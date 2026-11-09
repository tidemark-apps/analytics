<?php

namespace Tests\Feature;

use App\Models\User;
use App\Updates\UpdateException;
use App\Updates\Updater;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use ZipArchive;

class UpdaterTest extends TestCase
{
    use RefreshDatabase;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();
        $this->base = sys_get_temp_dir().'/tdm-upd-'.uniqid();
        foreach (['app/Old', 'storage/app', 'storage/framework', 'database', 'config', 'bootstrap/cache'] as $d) {
            mkdir($this->base.'/'.$d, 0775, true);
        }
        file_put_contents($this->base.'/VERSION', '1.0.0');
        file_put_contents($this->base.'/.env', 'APP_KEY=secret');
        file_put_contents($this->base.'/artisan', 'old');
        file_put_contents($this->base.'/app/Old/Gone.php', '<?php // removed in the new release');
        file_put_contents($this->base.'/app/Keep.php', 'old');
        file_put_contents($this->base.'/database/database.sqlite', 'user data');
        file_put_contents($this->base.'/storage/app/data.txt', 'keep me');
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->base);
        parent::tearDown();
    }

    /** @param array<string,string> $extra */
    private function release(string $version, array $extra = [], string $root = 'tidemark-X/', bool $complete = true): string
    {
        $files = ['artisan' => 'new', 'VERSION' => $version, 'app/Updates/Updater.php' => '<?php', 'vendor/autoload.php' => '<?php', 'config/tidemark.php' => '<?php', 'app/Keep.php' => 'new', '.env' => 'OVERWRITTEN', 'storage/app/data.txt' => 'OVERWRITTEN', 'database/database.sqlite' => 'OVERWRITTEN'] + $extra;
        if (! $complete) {
            unset($files['vendor/autoload.php']);
        }
        $path = $this->base.'/release-'.uniqid().'.zip';
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE);
        foreach ($files as $name => $content) {
            $zip->addFromString($root.$name, $content);
        }
        $zip->close();

        return $path;
    }

    public function test_apply_replaces_code_keeps_user_data_and_prunes_removed_files(): void
    {
        $result = (new Updater($this->base))->apply($this->release('1.1.0'));

        $this->assertSame(['from' => '1.0.0', 'to' => '1.1.0'], ['from' => $result['from'], 'to' => $result['to']]);
        $this->assertSame('1.1.0', trim(file_get_contents($this->base.'/VERSION')));
        $this->assertSame('new', file_get_contents($this->base.'/app/Keep.php'));
        $this->assertFileDoesNotExist($this->base.'/app/Old/Gone.php');
        $this->assertSame('APP_KEY=secret', file_get_contents($this->base.'/.env'));
        $this->assertSame('user data', file_get_contents($this->base.'/database/database.sqlite'));
        $this->assertSame('keep me', file_get_contents($this->base.'/storage/app/data.txt'));
        $this->assertFileExists($this->base.'/storage/framework/update-pending');
        $this->assertCount(1, glob($this->base.'/storage/app/updates/backups/backup-1.0.0-*.zip'));
        $this->assertEmpty(glob($this->base.'/**/*.tdm-new'));
    }

    public function test_release_without_a_wrapping_folder_is_accepted(): void
    {
        $info = (new Updater($this->base))->inspect($this->release('1.2.0', [], ''));
        $this->assertSame(['1.2.0', true], [$info['version'], $info['newer']]);
    }

    public function test_unsafe_incomplete_and_non_zip_files_are_rejected(): void
    {
        $updater = new Updater($this->base);
        foreach ([
            [$this->release('1.1.0', ['../evil.php' => 'x']), 'unsafe'],
            [$this->release('1.1.0', [], 'tidemark-X/', false), 'missing vendor/autoload.php'],
            [$this->release('banana'), 'valid version'],
        ] as [$zip, $message]) {
            try {
                $updater->inspect($zip);
                $this->fail("expected rejection: {$message}");
            } catch (UpdateException $e) {
                $this->assertStringContainsString($message, $e->getMessage());
            }
        }
        file_put_contents($this->base.'/not.zip', 'hello');
        $this->expectException(UpdateException::class);
        $updater->inspect($this->base.'/not.zip');
    }

    public function test_older_or_equal_versions_need_force(): void
    {
        $updater = new Updater($this->base);
        $this->assertFalse($updater->inspect($this->release('1.0.0'))['newer']);
        $this->assertFalse($updater->inspect($this->release('0.9.0'))['newer']);
        try {
            $updater->apply($this->release('1.0.0'));
            $this->fail('should refuse');
        } catch (UpdateException $e) {
            $this->assertStringContainsString('already on 1.0.0', $e->getMessage());
        }
        $this->assertSame('1.0.0', $updater->apply($this->release('1.0.0'), true)['to']);
    }

    public function test_finishing_runs_migrations_once_and_clears_the_marker(): void
    {
        $updater = new Updater($this->base);
        $updater->apply($this->release('1.1.0'));
        $meta = $updater->finishIfPending();
        $this->assertTrue($meta['ok']);
        $this->assertFileDoesNotExist($this->base.'/storage/framework/update-pending');
        $this->assertNull($updater->finishIfPending());
        $this->assertSame('1.0.0', $updater->lastUpdate()['from']);
    }

    public function test_upload_endpoints_are_admin_only_and_assemble_chunks(): void
    {
        $admin = User::create(['name' => 'A', 'email' => 'a@example.com', 'password' => 'password']);
        $admin->forceFill(['is_admin' => true])->save();
        $member = User::create(['name' => 'M', 'email' => 'm@example.com', 'password' => 'password']);
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');

        $this->actingAs($member)->getJson('/api/admin/update')->assertForbidden();
        $this->postJson('/api/admin/update/apply')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/admin/update')->assertOk()->assertJsonStructure(['version', 'limits' => ['chunk'], 'writable']);

        $zip = $this->release('9.9.9');
        $bytes = file_get_contents($zip);
        $mid = intdiv(strlen($bytes), 2);
        $id = '11111111-2222-3333-4444-555555555555';
        $send = fn (int $i, string $part) => $this->post('/api/admin/update/chunk', ['id' => $id, 'index' => $i, 'total' => 2, 'chunk' => UploadedFile::fake()->createWithContent('c.bin', $part)], ['Accept' => 'application/json']);

        $send(1, substr($bytes, $mid))->assertStatus(422); // out of order
        $send(0, substr($bytes, 0, $mid))->assertOk()->assertJson(['done' => false]);
        $send(1, substr($bytes, $mid))->assertOk()->assertJsonPath('staged.version', '9.9.9');
        $this->assertFileExists(storage_path('app/updates/incoming.zip'));
        $this->deleteJson('/api/admin/update')->assertOk();
        $this->assertFileDoesNotExist(storage_path('app/updates/incoming.zip'));
    }

    /** @return array{0:string,1:string} the zip's bytes and its sha256 */
    private function fakeGithub(string $version, ?string $sha = null, string $assetUrl = 'https://github.com/tidemark-apps/analytics/releases/download/v%s/tidemark-%s.zip'): array
    {
        $bytes = file_get_contents($this->release($version));
        $sha ??= hash('sha256', $bytes);
        $zipUrl = sprintf($assetUrl, $version, $version);
        Http::fake([
            'github.com/tidemark-apps/analytics/releases/latest' => Http::response('', 302, ['Location' => "https://github.com/tidemark-apps/analytics/releases/tag/v{$version}"]),
            'api.github.com/*' => Http::response(['tag_name' => 'v'.$version, 'body' => 'Notes', 'html_url' => 'https://github.com/x/y/releases/tag/v'.$version, 'published_at' => '2026-10-20T00:00:00Z', 'assets' => [
                ['name' => "tidemark-{$version}.zip", 'browser_download_url' => $zipUrl, 'size' => strlen($bytes)],
                ['name' => "tidemark-{$version}.zip.sha256", 'browser_download_url' => $zipUrl.'.sha256', 'size' => 85],
            ]]),
            '*.sha256' => Http::response("{$sha}  tidemark-{$version}.zip\n"),
            '*.zip' => Http::response($bytes),
        ]);

        return [$bytes, $sha];
    }

    public function test_latest_release_is_read_from_github(): void
    {
        $this->fakeGithub('1.5.0');
        $latest = (new Updater($this->base))->latest(true);
        $this->assertSame(['1.5.0', '1.0.0', true, 'Notes'], [$latest['version'], $latest['current'], $latest['newer'], $latest['notes']]);
        $this->assertStringEndsWith('tidemark-1.5.0.zip.sha256', $latest['sha_url']);
    }

    public function test_download_verifies_the_checksum_then_stages_the_zip(): void
    {
        $this->fakeGithub('1.5.0');
        $updater = new Updater($this->base);
        $info = $updater->downloadLatest();
        $this->assertSame('1.5.0', $info['version']);
        $this->assertFileExists($updater->stagedPath());
        $this->assertSame('1.5.0', $updater->apply($updater->stagedPath())['to']);
    }

    public function test_a_checksum_mismatch_discards_the_download(): void
    {
        $this->fakeGithub('1.5.0', str_repeat('a', 64));
        $updater = new Updater($this->base);
        try {
            $updater->downloadLatest();
            $this->fail('should reject');
        } catch (UpdateException $e) {
            $this->assertStringContainsString('checksum', $e->getMessage());
        }
        $this->assertFileDoesNotExist($updater->stagedPath());
        $this->assertFileDoesNotExist($updater->stagedPath().'.download');
    }

    public function test_assets_outside_the_configured_repository_are_refused(): void
    {
        $this->fakeGithub('1.5.0', null, 'https://evil.example/releases/download/v%s/tidemark-%s.zip');
        $this->expectException(UpdateException::class);
        (new Updater($this->base))->downloadLatest();
    }

    public function test_github_check_and_download_endpoints_are_admin_only(): void
    {
        $this->fakeGithub('1.5.0');
        $member = User::create(['name' => 'M', 'email' => 'm2@example.com', 'password' => 'password']);
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
        $this->actingAs($member)->getJson('/api/admin/update/check')->assertForbidden();
        $this->postJson('/api/admin/update/download')->assertForbidden();
        $member->forceFill(['is_admin' => true])->save();
        $this->getJson('/api/admin/update/check?fresh=1')->assertOk()->assertJsonPath('latest.version', '1.5.0');
    }

    public function test_files_replaced_by_hand_are_detected_and_migrated_once(): void
    {
        $updater = new Updater($this->base);
        $this->assertFalse($updater->hasPendingWork()); // not installed yet
        touch($this->base.'/storage/app/installed');
        $this->assertTrue($updater->hasPendingWork()); // no marker yet
        $this->assertTrue($updater->finishIfPending()['ok']);
        $this->assertFalse($updater->hasPendingWork());
        file_put_contents($this->base.'/VERSION', '1.1.0'); // as if new files were uploaded over FTP
        $this->assertTrue($updater->hasPendingWork());
        $meta = $updater->finishIfPending();
        $this->assertSame(['1.0.0', '1.1.0'], [$meta['from'], $meta['to']]);
        $this->assertFalse($updater->hasPendingWork());
    }

    public function test_the_daily_check_records_the_latest_release_and_flags_newer_ones(): void
    {
        config(['tidemark.update_check' => true]);
        $this->fakeGithub('1.5.0');
        $updater = new Updater($this->base);
        $this->assertNull($updater->availableUpdate());
        $updater->refreshIfStale();
        $this->assertSame(['version' => '1.5.0'], ['version' => $updater->availableUpdate()['version']]);

        file_put_contents($this->base.'/VERSION', '1.5.0'); // installed the update: the flag clears
        $this->assertNull($updater->availableUpdate());
    }

    public function test_checks_are_throttled_failures_are_remembered_and_the_switch_turns_them_off(): void
    {
        config(['tidemark.update_check' => true]);
        $this->fakeGithub('1.5.0');
        $updater = new Updater($this->base);
        $updater->refreshIfStale();
        $updater->refreshIfStale();
        Http::assertSentCount(2); // one check (redirect + API); the second call found a fresh result

        Http::swap(new Factory);
        Http::fake(['*' => Http::response('nope', 500)]);
        $updater->refreshIfStale(0);
        $last = $updater->lastCheck();
        $this->assertNotNull($last['error']);
        $this->assertSame('1.5.0', $last['version']); // the last good answer is kept
        $this->assertNotNull($updater->availableUpdate());

        config(['tidemark.update_check' => false]);
        $other = new Updater($this->base.'/off');
        @mkdir($this->base.'/off/storage/app', 0775, true);
        Http::fake();
        $other->refreshIfStale(0);
        Http::assertNothingSent();
    }

    public function test_me_reports_an_available_update_to_administrators_only(): void
    {
        config(['tidemark.update_check' => true]);
        $this->fakeGithub('9.0.0');
        $updater = new Updater($this->base);
        $updater->refreshIfStale();
        $this->app->instance(Updater::class, $updater);
        $admin = User::create(['name' => 'A', 'email' => 'adm@example.com', 'password' => 'password']);
        $admin->forceFill(['is_admin' => true])->save();
        $member = User::create(['name' => 'M', 'email' => 'mem@example.com', 'password' => 'password']);

        $this->actingAs($admin)->getJson('/api/me')->assertOk()->assertJsonPath('user.update.version', '9.0.0');
        $this->actingAs($member)->getJson('/api/me')->assertOk()->assertJsonMissingPath('user.update');
    }

    public function test_the_check_command_reports_the_result(): void
    {
        config(['tidemark.update_check' => true]);
        $this->fakeGithub('1.5.0');
        $this->app->instance(Updater::class, new Updater($this->base));
        $this->artisan('tidemark:check-updates')->expectsOutputToContain('Update available: 1.5.0')->assertSuccessful();
        config(['tidemark.update_check' => false]);
        $this->artisan('tidemark:check-updates')->expectsOutputToContain('turned off')->assertSuccessful();
    }

    public function test_the_version_is_found_even_when_the_rate_limited_api_refuses(): void
    {
        Http::fake([
            'github.com/tidemark-apps/analytics/releases/latest' => Http::response('', 302, ['Location' => 'https://github.com/tidemark-apps/analytics/releases/tag/v2.0.0']),
            'api.github.com/*' => Http::response(['message' => 'API rate limit exceeded'], 403),
        ]);
        $latest = (new Updater($this->base))->latest(true);
        $this->assertSame(['2.0.0', true, ''], [$latest['version'], $latest['newer'], $latest['notes']]);
        $this->assertSame('https://github.com/tidemark-apps/analytics/releases/download/v2.0.0/tidemark-2.0.0.zip', $latest['zip_url']);
        $this->assertSame($latest['zip_url'].'.sha256', $latest['sha_url']);
    }

    public function test_a_failure_of_both_github_routes_is_reported_not_hidden(): void
    {
        Http::fake(['*' => Http::response('', 500)]);
        $this->expectException(UpdateException::class);
        (new Updater($this->base))->latest(true);
    }

    public function test_the_dashboard_updater_can_be_turned_off_for_hosted_deployments(): void
    {
        config(['tidemark.updater' => false, 'tidemark.update_check' => true]);
        $admin = User::create(['name' => 'A', 'email' => 'off@example.com', 'password' => 'password']);
        $admin->forceFill(['is_admin' => true])->save();
        $this->withHeader('X-Requested-With', 'XMLHttpRequest')->actingAs($admin);

        $this->getJson('/api/admin/update')->assertNotFound();
        $this->getJson('/api/admin/update/check')->assertNotFound();
        $this->postJson('/api/admin/update/apply')->assertNotFound();
        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.updater_enabled', false)->assertJsonMissingPath('user.update');
        // saving the profile returns the same flag, so the dashboard never re-shows the Updates tab
        $this->postJson('/api/me', ['email' => 'renamed@example.com'])->assertOk()->assertJsonPath('user.updater_enabled', false);
    }
}
