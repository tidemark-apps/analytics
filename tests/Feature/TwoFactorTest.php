<?php

namespace Tests\Feature;

use App\Mail\TwoFactorCodeMail;
use App\Models\User;
use App\Support\Totp;
use App\Support\WebAuthn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
    }

    private function user(): User
    {
        return User::create(['name' => 'U', 'email' => 'u@example.com', 'password' => 'password']);
    }

    private function enableAuthenticator(User $user): string
    {
        $secret = $this->actingAs($user)->postJson('/api/me/two-factor')->assertOk()->json('secret');
        $this->postJson('/api/me/two-factor/confirm', ['code' => Totp::code($secret)])->assertOk();

        return $secret;
    }

    private function login(array $extra = [])
    {
        return $this->postJson('/api/auth/login', ['email' => 'u@example.com', 'password' => 'password'] + $extra);
    }

    public function test_authenticator_setup_returns_recovery_codes_once_and_sign_in_needs_a_code(): void
    {
        $user = $this->user();
        $secret = $this->actingAs($user)->postJson('/api/me/two-factor')->json('secret');
        $this->postJson('/api/me/two-factor/confirm', ['code' => '000000'])->assertStatus(422);

        $res = $this->postJson('/api/me/two-factor/confirm', ['code' => Totp::code($secret)])->assertOk();
        $this->assertCount(10, $res->json('recovery_codes'));
        $this->assertSame(10, $res->json('recovery_left'));

        $this->app['auth']->guard('web')->logout();
        $this->login()->assertStatus(202)->assertJsonPath('methods', ['totp', 'recovery']);
        $this->login(['code' => '000000'])->assertStatus(422);
        $this->login(['code' => Totp::code($secret)])->assertOk();
    }

    public function test_a_recovery_code_works_once(): void
    {
        $user = $this->user();
        $secret = $this->actingAs($user)->postJson('/api/me/two-factor')->json('secret');
        $codes = $this->postJson('/api/me/two-factor/confirm', ['code' => Totp::code($secret)])->json('recovery_codes');
        $this->app['auth']->guard('web')->logout();

        $this->login(['method' => 'recovery', 'code' => strtoupper($codes[0])])->assertOk();
        $this->app['auth']->guard('web')->logout();
        $this->login(['method' => 'recovery', 'code' => $codes[0]])->assertStatus(422);
        $this->assertSame(9, $user->fresh()->two_factor_recovery_codes ? count($user->fresh()->two_factor_recovery_codes) : 0);
    }

    public function test_email_codes_need_working_mail_and_are_single_use(): void
    {
        Mail::fake();
        $user = $this->user();
        $this->actingAs($user)->postJson('/api/me/two-factor/email')->assertStatus(422); // mailer is "array"

        config(['mail.default' => 'smtp']);
        $this->postJson('/api/me/two-factor/email')->assertOk();
        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });
        $this->postJson('/api/me/two-factor/email/confirm', ['code' => '999999'])->assertStatus(422);
        $res = $this->postJson('/api/me/two-factor/email/confirm', ['code' => $code])->assertOk();
        $this->assertTrue($res->json('email'));
        $this->assertCount(10, $res->json('recovery_codes'));

        $this->app['auth']->guard('web')->logout();
        $this->login()->assertStatus(202)->assertJsonPath('methods', ['email', 'recovery']);
        $this->postJson('/api/auth/two-factor/email', ['email' => 'u@example.com', 'password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/auth/two-factor/email', ['email' => 'u@example.com', 'password' => 'password'])->assertOk();
        Mail::assertSent(TwoFactorCodeMail::class, 2);
        $this->login(['method' => 'email', 'code' => '000000'])->assertStatus(422);
        $fresh = null;
        Mail::assertSent(TwoFactorCodeMail::class, function ($m) use (&$fresh) {
            $fresh = $m->code;

            return true;
        });
        $this->login(['method' => 'email', 'code' => $fresh])->assertOk();
        $this->app['auth']->guard('web')->logout();
        $this->login(['method' => 'email', 'code' => $fresh])->assertStatus(422); // used up
    }

    public function test_an_email_code_stops_working_after_too_many_wrong_guesses(): void
    {
        Mail::fake();
        config(['mail.default' => 'smtp']);
        $user = $this->user();
        $user->forceFill(['two_factor_email_confirmed_at' => now()])->save();
        $this->postJson('/api/auth/two-factor/email', ['email' => 'u@example.com', 'password' => 'password'])->assertOk();
        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function ($m) use (&$code) {
            $code = $m->code;

            return true;
        });
        for ($i = 0; $i < 5; $i++) {
            $this->login(['method' => 'email', 'code' => $code === '111111' ? '222222' : '111111'])->assertStatus(422);
        }
        $this->login(['method' => 'email', 'code' => $code])->assertStatus(422);
    }

    public function test_turning_off_the_last_method_removes_recovery_codes(): void
    {
        $user = $this->user();
        $this->enableAuthenticator($user);
        $this->deleteJson('/api/me/two-factor', ['password' => 'nope'])->assertStatus(422);
        $this->deleteJson('/api/me/two-factor', ['password' => 'password'])->assertOk()->assertJsonPath('two_factor', false);
        $this->assertNull($user->fresh()->two_factor_recovery_codes);
        $this->app['auth']->guard('web')->logout();
        $this->login()->assertOk();
    }

    public function test_regenerating_recovery_codes_needs_the_password_and_replaces_the_old_ones(): void
    {
        $user = $this->user();
        $this->enableAuthenticator($user);
        $this->postJson('/api/me/two-factor/recovery-codes', ['password' => 'nope'])->assertStatus(422);
        $codes = $this->postJson('/api/me/two-factor/recovery-codes', ['password' => 'password'])->assertOk()->json('recovery_codes');
        $this->assertCount(10, $codes);
    }

    // ---- passkeys, with a software authenticator

    private function origin(): string
    {
        return 'http://localhost:8000';
    }

    /** A made-up ES256 authenticator: enough to produce what a browser would send back. */
    private function makeKey(): array
    {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $d = openssl_pkey_get_details($key);

        // OpenSSL drops leading zero bytes; COSE coordinates are always 32 bytes
        return [$key, str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT), str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT)];
    }

    private function cborBytes(string $b): string
    {
        return $this->cborHead(2, strlen($b)).$b;
    }

    private function cborText(string $t): string
    {
        return $this->cborHead(3, strlen($t)).$t;
    }

    private function cborInt(int $n): string
    {
        return $n >= 0 ? $this->cborHead(0, $n) : $this->cborHead(1, -1 - $n);
    }

    private function cborHead(int $major, int $n): string
    {
        return $n < 24 ? chr($major << 5 | $n) : ($n < 256 ? chr($major << 5 | 24).chr($n) : chr($major << 5 | 25).pack('n', $n));
    }

    private function register(User $user, array $keyPair, string $credentialId = 'cred-1'): void
    {
        [, $x, $y] = $keyPair;
        $options = $this->actingAs($user)->postJson('/api/me/passkeys/options')->assertOk()->json();
        $this->assertSame('localhost', $options['rp']['id']);

        $cose = "\xA5".$this->cborInt(1).$this->cborInt(2).$this->cborInt(3).$this->cborInt(-7).$this->cborInt(-1).$this->cborInt(1)
            .$this->cborInt(-2).$this->cborBytes($x).$this->cborInt(-3).$this->cborBytes($y);
        $auth = hash('sha256', 'localhost', true)."\x45".pack('N', 0).str_repeat("\0", 16).pack('n', strlen($credentialId)).$credentialId.$cose;
        $attestation = "\xA3".$this->cborText('fmt').$this->cborText('none').$this->cborText('attStmt')."\xA0".$this->cborText('authData').$this->cborBytes($auth);
        $client = json_encode(['type' => 'webauthn.create', 'challenge' => $options['challenge'], 'origin' => $this->origin()]);

        $this->postJson('/api/me/passkeys', [
            'name' => 'Test key',
            'clientDataJSON' => WebAuthn::b64uEncode($client),
            'attestationObject' => WebAuthn::b64uEncode($attestation),
        ])->assertOk();
    }

    private function assertion(array $keyPair, array $options, string $credentialId = 'cred-1', int $count = 1, ?string $challenge = null): array
    {
        $client = json_encode(['type' => 'webauthn.get', 'challenge' => $challenge ?? $options['challenge'], 'origin' => $this->origin()]);
        $auth = hash('sha256', 'localhost', true)."\x05".pack('N', $count);
        openssl_sign($auth.hash('sha256', $client, true), $sig, $keyPair[0], OPENSSL_ALGO_SHA256);

        return [
            'id' => WebAuthn::b64uEncode($credentialId),
            'clientDataJSON' => WebAuthn::b64uEncode($client),
            'authenticatorData' => WebAuthn::b64uEncode($auth),
            'signature' => WebAuthn::b64uEncode($sig),
        ];
    }

    public function test_a_passkey_can_be_registered_and_used_to_sign_in(): void
    {
        $user = $this->user();
        $keys = $this->makeKey();
        $this->register($user, $keys);
        $this->assertTrue($user->fresh()->hasTwoFactor());
        $this->assertSame(1, $user->passkeys()->count());
        $this->getJson('/api/me/two-factor')->assertJsonPath('passkeys.0.name', 'Test key')->assertJsonMissingPath('passkeys.0.public_key');

        $this->app['auth']->guard('web')->logout();
        $this->login()->assertStatus(202)->assertJsonPath('methods', ['passkey', 'recovery']);
        $options = $this->postJson('/api/auth/two-factor/passkey', ['email' => 'u@example.com', 'password' => 'password'])->assertOk()->json();
        $this->assertSame(WebAuthn::b64uEncode('cred-1'), $options['allowCredentials'][0]['id']);

        // wrong challenge, then a signature from another key, then the real thing
        $this->login(['method' => 'passkey', 'passkey' => $this->assertion($keys, $options, challenge: 'other')])->assertStatus(422);
        $options = $this->postJson('/api/auth/two-factor/passkey', ['email' => 'u@example.com', 'password' => 'password'])->json();
        $this->login(['method' => 'passkey', 'passkey' => $this->assertion($this->makeKey(), $options)])->assertStatus(422);
        $options = $this->postJson('/api/auth/two-factor/passkey', ['email' => 'u@example.com', 'password' => 'password'])->json();
        $this->login(['method' => 'passkey', 'passkey' => $this->assertion($keys, $options)])->assertOk();
        $this->assertNotNull($user->passkeys()->first()->last_used_at);

        // replaying the same response fails: the challenge was used up
        $this->app['auth']->guard('web')->logout();
        $this->login(['method' => 'passkey', 'passkey' => $this->assertion($keys, $options)])->assertStatus(422);
    }

    public function test_a_passkey_counter_that_does_not_increase_is_refused(): void
    {
        $user = $this->user();
        $keys = $this->makeKey();
        $this->register($user, $keys);
        $this->app['auth']->guard('web')->logout();
        foreach ([[5, 200], [5, 422]] as [$count, $status]) {
            $options = $this->postJson('/api/auth/two-factor/passkey', ['email' => 'u@example.com', 'password' => 'password'])->json();
            $this->login(['method' => 'passkey', 'passkey' => $this->assertion($keys, $options, count: $count)])->assertStatus($status);
            $this->app['auth']->guard('web')->logout();
        }
    }

    public function test_registration_checks_the_challenge_and_removal_needs_the_password(): void
    {
        $user = $this->user();
        $this->actingAs($user)->postJson('/api/me/passkeys/options')->assertOk();
        $this->postJson('/api/me/passkeys', [
            'clientDataJSON' => WebAuthn::b64uEncode(json_encode(['type' => 'webauthn.create', 'challenge' => 'wrong', 'origin' => $this->origin()])),
            'attestationObject' => WebAuthn::b64uEncode("\xA0"),
        ])->assertStatus(422);
        $this->assertSame(0, $user->passkeys()->count());

        $this->register($user, $this->makeKey());
        $id = $user->passkeys()->first()->id;
        $this->deleteJson("/api/me/passkeys/$id", ['password' => 'nope'])->assertStatus(422);
        $this->deleteJson("/api/me/passkeys/$id", ['password' => 'password'])->assertOk()->assertJsonPath('two_factor', false);
        $this->assertSame(0, $user->passkeys()->count());
    }

    public function test_one_person_cannot_remove_anothers_passkey(): void
    {
        $a = $this->user();
        $this->register($a, $this->makeKey());
        $id = $a->passkeys()->first()->id;
        $b = User::create(['name' => 'B', 'email' => 'b@example.com', 'password' => 'password']);
        $this->actingAs($b)->deleteJson("/api/me/passkeys/$id", ['password' => 'password'])->assertOk();
        $this->assertSame(1, $a->passkeys()->count());
    }
}
