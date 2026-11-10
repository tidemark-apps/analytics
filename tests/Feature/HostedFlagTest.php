<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HostedFlagTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_page_tells_the_front_end_whether_the_install_is_hosted(): void
    {
        $this->assertStringContainsString('hosted: false', $this->get('/login')->getContent());

        config(['tidemark.hosted' => true]);

        $this->assertStringContainsString('hosted: true', $this->get('/login')->getContent());
    }
}
