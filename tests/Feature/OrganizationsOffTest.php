<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationsOffTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('X-Requested-With', 'XMLHttpRequest');
        $this->owner = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'password']);
    }

    private function organizationsOff(): void
    {
        config(['tidemark.organizations' => false]);
        $this->actingAs($this->owner);
    }

    public function test_organization_and_team_endpoints_do_not_exist_when_organizations_are_off(): void
    {
        $this->organizationsOff();
        $personal = Organization::personalFor($this->owner)->id;
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();

        $this->getJson('/api/organizations')->assertNotFound();
        $this->postJson('/api/organizations', ['name' => 'Foggy Mountain'])->assertNotFound();
        $this->getJson("/api/organizations/{$personal}")->assertNotFound();
        $this->getJson('/api/teams')->assertNotFound();
        $this->postJson('/api/teams', ['name' => 'Editors'])->assertNotFound();
        $this->getJson('/api/sites/example.com/move')->assertNotFound();
        $this->postJson('/api/sites/example.com/teams', ['team_id' => 'x', 'role' => 'viewer'])->assertNotFound();
    }

    public function test_the_endpoints_work_when_organizations_are_on(): void
    {
        $this->actingAs($this->owner);

        $this->getJson('/api/organizations')->assertOk();
        $this->postJson('/api/organizations', ['name' => 'Foggy Mountain'])->assertCreated();
        $this->getJson('/api/teams')->assertOk();
    }

    public function test_sites_stay_in_the_personal_organization_even_when_another_is_requested(): void
    {
        $this->actingAs($this->owner);
        $other = $this->postJson('/api/organizations', ['name' => 'Foggy Mountain'])->assertCreated()->json('data.id');
        $this->organizationsOff();

        $this->postJson('/api/sites', ['domain' => 'example.com', 'organization' => $other])->assertCreated();

        $this->assertSame(Organization::personalFor($this->owner)->id, Site::where('domain', 'example.com')->value('organization_id'));
    }

    public function test_me_lists_only_the_personal_organization_when_organizations_are_off(): void
    {
        $this->actingAs($this->owner);
        $this->postJson('/api/organizations', ['name' => 'Foggy Mountain'])->assertCreated();
        $this->assertCount(2, $this->getJson('/api/me')->json('user.organizations'));

        $this->organizationsOff();

        $this->assertSame(['Personal'], collect($this->getJson('/api/me')->json('user.organizations'))->pluck('name')->all());
    }

    public function test_the_page_tells_the_dashboard_whether_organizations_are_on(): void
    {
        $this->artisan('migrate');
        config(['tidemark.organizations' => false]);

        $this->get('/login')->assertSee('organizations: false', false);

        config(['tidemark.organizations' => true]);

        $this->get('/login')->assertSee('organizations: true', false);
    }

    public function test_sharing_a_site_with_a_person_still_works_when_organizations_are_off(): void
    {
        $this->organizationsOff();
        $colleague = User::create(['name' => 'Colleague', 'email' => 'colleague@example.com', 'password' => 'password']);
        $this->postJson('/api/sites', ['domain' => 'example.com'])->assertCreated();

        $this->postJson('/api/sites/example.com/people', ['email' => $colleague->email, 'role' => 'viewer'])->assertSuccessful();

        $this->actingAs($colleague);
        $this->assertContains('example.com', collect($this->getJson('/api/sites')->json('data'))->pluck('domain')->all());
    }
}
