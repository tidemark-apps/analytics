<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\User;
use App\Support\Installer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class Provision extends Command
{
    protected $signature = 'tidemark:provision
        {email : the address of the person who will own this install}
        {--name= : their name (the part of the address before the @ by default)}
        {--hours=72 : how long the one-time setup link works}
        {--json : print the result as JSON}';

    protected $description = 'Set up a fresh install without the web installer: migrate, create the owner and print a one-time link to choose a password';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid e-mail address.');

            return self::FAILURE;
        }

        $this->callSilently('migrate', ['--force' => true]);
        $this->ensureSalt();

        $user = User::where('email', $email)->first();
        $created = $user === null;
        $user ??= $this->createOwner($email);

        $result = [
            'created' => $created,
            'user_id' => $user->id,
            'email' => $user->email,
            'setup_url' => $this->setupUrl($user),
            'expires_hours' => (int) $this->option('hours'),
        ];

        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_UNESCAPED_SLASHES));
        } else {
            $this->info($created ? "Created {$user->email}." : "{$user->email} already has an account.");
            $this->line("Setup link (works once, for {$result['expires_hours']} hours): {$result['setup_url']}");
        }

        return self::SUCCESS;
    }

    /** The first person on an install owns it, like the one the web installer creates; later ones are ordinary accounts. */
    private function createOwner(string $email): User
    {
        $user = User::create([
            'name' => $this->option('name') ?: Str::before($email, '@'),
            'email' => $email,
            'password' => Str::random(40),
            'is_admin' => ! User::exists(),
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        Organization::personalFor($user);

        return $user;
    }

    /** Visitor ids are hashed with this salt, so an install without one must not start counting. */
    private function ensureSalt(): void
    {
        if (config('tidemark.salt')) {
            return;
        }
        Installer::writeEnv(['TIDEMARK_SALT' => Str::random(40)]);
        $this->warn('TIDEMARK_SALT was empty: a new one was written to the settings file. Restart the app to use it.');
    }

    private function setupUrl(User $user): string
    {
        config(['auth.passwords.users.expire' => max(1, (int) $this->option('hours')) * 60]);
        $token = Password::broker()->createToken($user);

        return url('/reset-password?token='.$token.'&email='.urlencode($user->email));
    }
}
