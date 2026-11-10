<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * A short-lived, single-use sign-in token from the host that runs this install (a hosting or billing service), for two things:
 * a customer arriving from the host's portal, and someone from the host's support looking at an account.
 *
 * Format: `base64url(json claims) . "." . base64url(Ed25519 signature of the first part)`. The host signs with a private key it keeps;
 * the install only holds the public key (`TIDEMARK_SSO_PUBLIC_KEY`, base64), so taking over one install cannot forge a token.
 *
 * Claims: `aud` (the install's host name, so a token for one install does not work on another), `iat`, `exp` (at most two minutes after
 * `iat`), `jti` (unique; a token works once), `kind` ("customer" or "support"). A customer token names the account with `email`. A
 * support token carries `staff` {id, name}, optional `reason`, `ticket` and `email` (the owner's account by default) and `minutes`
 * (how long the session lasts, at most 60).
 */
class HostToken
{
    public const MAX_LIFETIME = 120;

    public const MAX_SUPPORT_MINUTES = 60;

    public static function enabled(): bool
    {
        return (string) config('tidemark.sso_public_key') !== '';
    }

    /** @return array<string,mixed>|null the claims of a valid token that has not been used, and marks it used; null otherwise */
    public static function redeem(string $token): ?array
    {
        $claims = self::verify($token);
        if ($claims === null || ! Cache::add('host-token:'.$claims['jti'], 1, now()->addSeconds(self::MAX_LIFETIME * 2))) {
            return null;
        }

        return $claims;
    }

    /** @return array<string,mixed>|null */
    public static function verify(string $token): ?array
    {
        $key = base64_decode((string) config('tidemark.sso_public_key'), true);
        $parts = explode('.', $token);
        if (! self::enabled() || $key === false || strlen($key) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES || count($parts) !== 2) {
            return null;
        }
        $signature = self::decode($parts[1]);
        if ($signature === null || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES || ! sodium_crypto_sign_verify_detached($signature, $parts[0], $key)) {
            return null;
        }
        $json = self::decode($parts[0]);
        $claims = $json === null ? null : json_decode($json, true);

        return is_array($claims) && self::valid($claims) ? $claims : null;
    }

    /** @param array<string,mixed> $claims */
    private static function valid(array $claims): bool
    {
        $now = time();
        $audience = parse_url((string) config('app.url'), PHP_URL_HOST);
        foreach (['aud', 'jti', 'kind'] as $required) {
            if (! isset($claims[$required]) || ! is_string($claims[$required]) || $claims[$required] === '') {
                return false;
            }
        }
        if (! is_int($claims['iat'] ?? null) || ! is_int($claims['exp'] ?? null)) {
            return false;
        }
        // five seconds of slack for clocks that disagree a little
        if ($claims['aud'] !== $audience || $claims['exp'] < $now || $claims['iat'] > $now + 5 || $claims['exp'] - $claims['iat'] > self::MAX_LIFETIME) {
            return false;
        }

        return match ($claims['kind']) {
            'customer' => is_string($claims['email'] ?? null),
            'support' => is_string($claims['staff']['id'] ?? null) && is_string($claims['staff']['name'] ?? null),
            default => false,
        };
    }

    private static function decode(string $part): ?string
    {
        $raw = base64_decode(strtr($part, '-_', '+/'), true);

        return $raw === false ? null : $raw;
    }
}
