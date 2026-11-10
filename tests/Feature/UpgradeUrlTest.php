<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpgradeUrlTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_page_hands_the_front_end_the_upgrade_address_only_when_one_is_set(): void
    {
        $this->assertStringContainsString('upgradeUrl: null', $this->get('/login')->getContent());

        config(['tidemark.upgrade_url' => 'https://account.example.test/portal/services/7']);

        $this->assertStringContainsString('upgradeUrl: "https:\/\/account.example.test\/portal\/services\/7"', $this->get('/login')->getContent());
    }
}
