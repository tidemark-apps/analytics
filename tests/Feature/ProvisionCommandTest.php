<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProvisionCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['tidemark.salt' => 'test-salt']);
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
    }

    /** @return array{created:bool,user_id:string,email:string,setup_url:string,expires_hours:int} */
    private function provision(string $email, array $options = []): array
    {
        $this->assertSame(0, Artisan::call('tidemark:provision', ['email' => $email, '--json' => true] + $options));

        return json_decode(trim(Artisan::output()), true);
    }

    /** @return array{token:string,email:string} */
    private function parts(string $setupUrl): array
    {
        parse_str(parse_url($setupUrl, PHP_URL_QUERY), $query);

        return ['token' => $query['token'], 'email' => $query['email']];
    }

    public function test_the_first_person_becomes_an_admin_with_a_verified_address_and_a_personal_organization(): void
    {
        $result = $this->provision('Owner@Example.com', ['--name' => 'Pat Owner']);

        $this->assertTrue($result['created']);
        $user = User::findOrFail($result['user_id']);
        $this->assertSame('owner@example.com', $user->email);
        $this->assertSame('Pat Owner', $user->name);
        $this->assertTrue($user->is_admin);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Organization::where('owner_id', $user->id)->where('personal', true)->exists());
    }

    public function test_the_setup_link_lets_the_owner_choose_a_password_once(): void
    {
        $result = $this->provision('owner@example.com');
        $link = $this->parts($result['setup_url']);

        $this->assertStringContainsString('/reset-password?token=', $result['setup_url']);
        $this->postJson('/api/auth/reset-password', $link + ['password' => 'a-long-passphrase', 'password_confirmation' => 'a-long-passphrase'])->assertOk();
        $this->assertTrue(Hash::check('a-long-passphrase', User::where('email', 'owner@example.com')->value('password')));
        $this->postJson('/api/auth/reset-password', $link + ['password' => 'another-passphrase', 'password_confirmation' => 'another-passphrase'])->assertUnprocessable();
    }

    public function test_running_it_again_keeps_the_account_and_replaces_the_link(): void
    {
        $first = $this->provision('owner@example.com');
        $second = $this->provision('owner@example.com');

        $this->assertFalse($second['created']);
        $this->assertSame($first['user_id'], $second['user_id']);
        $this->assertSame(1, User::count());
        $this->postJson('/api/auth/reset-password', $this->parts($first['setup_url']) + ['password' => 'a-long-passphrase', 'password_confirmation' => 'a-long-passphrase'])->assertUnprocessable();
        $this->postJson('/api/auth/reset-password', $this->parts($second['setup_url']) + ['password' => 'a-long-passphrase', 'password_confirmation' => 'a-long-passphrase'])->assertOk();
    }

    public function test_a_second_address_gets_an_ordinary_account(): void
    {
        $this->provision('owner@example.com');
        $other = $this->provision('colleague@example.com');

        $this->assertFalse(User::findOrFail($other['user_id'])->is_admin);
    }

    public function test_the_link_expires_after_the_hours_given(): void
    {
        $result = $this->provision('owner@example.com', ['--hours' => 2]);
        $this->assertSame(2, $result['expires_hours']);

        $this->travel(3)->hours();

        $this->postJson('/api/auth/reset-password', $this->parts($result['setup_url']) + ['password' => 'a-long-passphrase', 'password_confirmation' => 'a-long-passphrase'])->assertUnprocessable();
    }

    public function test_an_invalid_address_is_refused(): void
    {
        $this->assertSame(1, Artisan::call('tidemark:provision', ['email' => 'not-an-address']));
        $this->assertSame(0, User::count());
    }
}
