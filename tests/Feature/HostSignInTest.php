<?php

namespace Tests\Feature;

use App\Models\SupportSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class HostSignInTest extends TestCase
{
    use RefreshDatabase;

    private string $secretKey;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $pair = sodium_crypto_sign_keypair();
        $this->secretKey = sodium_crypto_sign_secretkey($pair);
        config(['tidemark.sso_public_key' => base64_encode(sodium_crypto_sign_publickey($pair)), 'app.url' => 'https://acme.example.com', 'tidemark.support_access' => true]);
        Cache::flush();
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
        $this->owner = User::create(['name' => 'Owner', 'email' => 'owner@acme.test', 'password' => 'password', 'is_admin' => true]);
    }

    /** @param array<string,mixed> $claims */
    private function token(array $claims = [], ?string $key = null): string
    {
        $now = time();
        $claims += ['aud' => 'acme.example.com', 'iat' => $now, 'exp' => $now + 60, 'jti' => bin2hex(random_bytes(8)), 'kind' => 'customer', 'email' => 'owner@acme.test'];
        $part = rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '=');
        $signature = rtrim(strtr(base64_encode(sodium_crypto_sign_detached($part, $key ?? $this->secretKey)), '+/', '-_'), '=');

        return "{$part}.{$signature}";
    }

    /** @param array<string,mixed> $claims */
    private function supportToken(array $claims = []): string
    {
        return $this->token($claims + ['kind' => 'support', 'staff' => ['id' => 's-7', 'name' => 'Sam Support'], 'reason' => 'Events missing', 'ticket' => 'T-1042']);
    }

    public function test_a_customer_token_signs_the_account_in(): void
    {
        $this->get('/sso?token='.$this->token())->assertRedirect('/sites');

        $this->assertAuthenticatedAs($this->owner);
        $this->assertNull($this->getJson('/api/me')->json('user.support'));
    }

    /** Swaps the first character of the signature for a different one, so the result never equals the original. */
    private function tamper(string $token): string
    {
        [$payload, $signature] = explode('.', $token, 2);

        return $payload.'.'.($signature[0] === 'A' ? 'B' : 'A').substr($signature, 1);
    }

    public function test_a_token_works_only_once(): void
    {
        $token = $this->token();
        $this->get('/sso?token='.$token)->assertRedirect('/sites');
        $this->post('/api/auth/logout');

        $this->get('/sso?token='.$token)->assertForbidden();
        $this->assertGuest();
    }

    public function test_tokens_that_should_not_work_are_refused(): void
    {
        $other = sodium_crypto_sign_secretkey(sodium_crypto_sign_keypair());
        $now = time();
        $refused = [
            'signed by someone else' => $this->token([], $other),
            'meant for another install' => $this->token(['aud' => 'other.example.com']),
            'expired' => $this->token(['iat' => $now - 300, 'exp' => $now - 100]),
            'valid for too long' => $this->token(['iat' => $now, 'exp' => $now + 3600]),
            'from the future' => $this->token(['iat' => $now + 600, 'exp' => $now + 660]),
            'unknown kind' => $this->token(['kind' => 'admin']),
            'support without a staff member' => $this->token(['kind' => 'support']),
            'tampered' => $this->tamper($this->token()),
            'not a token' => 'nonsense',
        ];

        foreach ($refused as $why => $token) {
            $this->get('/sso?token='.$token)->assertForbidden();
            $this->assertFalse(auth()->check(), $why);
        }
    }

    public function test_nothing_works_when_the_install_has_no_host_key(): void
    {
        config(['tidemark.sso_public_key' => null]);

        $this->get('/sso?token='.$this->token())->assertForbidden();
        $this->assertGuest();
    }

    public function test_an_account_that_does_not_exist_gets_a_not_found(): void
    {
        $this->get('/sso?token='.$this->token(['email' => 'nobody@acme.test']))->assertNotFound();
    }

    public function test_a_support_token_opens_a_session_on_the_owners_account_and_records_it(): void
    {
        $this->get('/sso?token='.$this->supportToken(['minutes' => 20]))->assertRedirect('/sites');

        $this->assertAuthenticatedAs($this->owner);
        $session = SupportSession::firstOrFail();
        $this->assertSame($this->owner->id, $session->user_id);
        $this->assertSame('Sam Support', $session->staff_name);
        $this->assertSame('Events missing', $session->reason);
        $this->assertSame('T-1042', $session->ticket);
        $this->assertEqualsWithDelta(20, $session->started_at->diffInMinutes($session->expires_at), 1);
        $me = $this->getJson('/api/me')->json('user.support');
        $this->assertSame('Sam Support', $me['staff_name']);
        $this->assertTrue($me['open']);
    }

    public function test_a_support_session_is_limited_to_an_hour(): void
    {
        $this->get('/sso?token='.$this->supportToken(['minutes' => 600]));

        $session = SupportSession::firstOrFail();
        $this->assertEqualsWithDelta(60, $session->started_at->diffInMinutes($session->expires_at), 1);
    }

    public function test_a_support_session_can_read_and_cannot_change_anything(): void
    {
        $this->actingAs($this->owner);
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();
        $this->post('/api/auth/logout');
        $this->get('/sso?token='.$this->supportToken());

        $this->getJson('/api/sites')->assertOk()->assertJsonPath('data.0.domain', 'example.com');
        $this->postJson('/api/sites', ['domain' => 'second.com'])->assertForbidden();
        $this->postJson('/api/me', ['name' => 'Changed'])->assertForbidden();
        $this->postJson('/api/me/keys', ['name' => 'sneaky'])->assertForbidden();
        $this->assertSame('Owner', $this->owner->fresh()->name);
    }

    public function test_a_support_session_stops_when_its_time_is_up(): void
    {
        $this->get('/sso?token='.$this->supportToken(['minutes' => 10]));
        $this->getJson('/api/sites')->assertOk();

        $this->travel(11)->minutes();

        $this->getJson('/api/sites')->assertUnauthorized();
        $this->assertGuest();
        $this->assertNotNull(SupportSession::firstOrFail()->ended_at);
    }

    public function test_ending_the_session_signs_out_and_marks_it_ended(): void
    {
        $this->get('/sso?token='.$this->supportToken());

        $this->postJson('/api/support/end')->assertOk();

        $this->assertGuest();
        $this->assertNotNull(SupportSession::firstOrFail()->ended_at);
        $this->assertFalse(SupportSession::firstOrFail()->isOpen());
    }

    public function test_support_access_can_be_turned_off(): void
    {
        config(['tidemark.support_access' => false]);

        $this->get('/sso?token='.$this->supportToken())->assertForbidden();
        $this->assertSame(0, SupportSession::count());
        $this->assertGuest();
    }

    public function test_the_owner_sees_who_looked_at_the_account_and_why(): void
    {
        $this->get('/sso?token='.$this->supportToken());
        $this->postJson('/api/support/end');

        $this->actingAs($this->owner);
        $log = $this->getJson('/api/me/support-sessions')->assertOk()->json('data');

        $this->assertCount(1, $log);
        $this->assertSame('Sam Support', $log[0]['staff_name']);
        $this->assertSame('Events missing', $log[0]['reason']);
        $this->assertFalse($log[0]['open']);
    }

    public function test_someone_elses_account_log_is_not_shown(): void
    {
        $this->get('/sso?token='.$this->supportToken());
        $this->postJson('/api/support/end');
        $other = User::create(['name' => 'Other', 'email' => 'other@acme.test', 'password' => 'password']);

        $this->actingAs($other);

        $this->assertSame([], $this->getJson('/api/me/support-sessions')->json('data'));
    }
}
