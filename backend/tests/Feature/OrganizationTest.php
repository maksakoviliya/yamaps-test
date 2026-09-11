<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\OrganizationStatus;
use App\Jobs\ParseOrganizationReviews;
use App\Models\Organization;
use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OrganizationTest extends TestCase
{
    use RefreshDatabase;

    private function fromFrontend(): static
    {
        return $this->withHeader('Origin', env('FRONTEND_URL', 'http://localhost:5173'));
    }

    public function test_guest_cannot_access_organization_endpoints(): void
    {
        $organization = Organization::factory()->create();

        $this->fromFrontend()->postJson('/api/organizations', ['url' => 'https://yandex.ru/maps/org/x/1/'])
            ->assertStatus(401);
        $this->fromFrontend()->getJson('/api/organizations')->assertStatus(401);
        $this->fromFrontend()->getJson("/api/organizations/{$organization->id}")->assertStatus(401);
        $this->fromFrontend()->getJson("/api/organizations/{$organization->id}/reviews")->assertStatus(401);
    }

    public function test_url_must_be_a_supported_provider_link(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()
            ->postJson('/api/organizations', ['url' => 'https://google.com/maps/org/x/1/'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('url');
    }

    public function test_connecting_an_organization_dispatches_the_parse_job(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        $response = $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
        ]);

        $response->assertCreated()->assertJsonPath('status', 'pending');

        $this->assertDatabaseCount('organizations', 1);
        Queue::assertPushed(ParseOrganizationReviews::class);
    }

    public function test_resubmitting_the_same_business_while_still_in_progress_does_not_duplicate_or_requeue(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
        ])->assertCreated();

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/reviews/',
        ])->assertOk();

        $this->assertDatabaseCount('organizations', 1);
        Queue::assertPushed(ParseOrganizationReviews::class, 1);
    }

    public function test_resubmitting_the_same_business_after_it_settled_requeues_a_parse(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        Organization::factory()->for($user)->create([
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
            'yandex_business_id' => '1364580496',
            'status' => OrganizationStatus::Ready,
        ]);

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/reviews/',
        ])->assertOk()->assertJsonPath('status', 'pending');

        $this->assertDatabaseCount('organizations', 1);
        Queue::assertPushed(ParseOrganizationReviews::class, 1);
    }

    public function test_a_different_user_submitting_the_same_business_reuses_the_existing_organization(): void
    {
        Queue::fake();

        $firstUser = User::factory()->create();
        $existing = Organization::factory()->for($firstUser)->create([
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
            'yandex_business_id' => '1364580496',
            'status' => OrganizationStatus::Ready,
        ]);

        $secondUser = User::factory()->create();

        $this->actingAs($secondUser, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
        ])->assertOk();

        $this->assertDatabaseCount('organizations', 1);
        Queue::assertPushed(ParseOrganizationReviews::class, 1);
        $this->assertSame($firstUser->id, $existing->fresh()->user_id);
    }

    public function test_connecting_a_different_business_adds_a_second_organization(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/kofemaniya/1364580496/',
        ])->assertCreated();

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/drugoe-mesto/999999/',
        ])->assertCreated();

        $this->assertDatabaseCount('organizations', 2);
    }

    public function test_index_lists_all_organizations(): void
    {
        $user = User::factory()->create();
        Organization::factory()->for($user)->count(2)->create();
        Organization::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()->getJson('/api/organizations')
            ->assertOk()
            ->assertJsonCount(3);
    }

    public function test_show_returns_404_for_an_unknown_organization(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()->getJson('/api/organizations/01jappv1z8g8k5x4qw2xj0mvzz')
            ->assertStatus(404);
    }

    public function test_show_returns_the_organization(): void
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->for($user)->create(['name' => 'Кофемания']);

        $this->actingAs($user, 'web')->fromFrontend()->getJson("/api/organizations/{$organization->id}")
            ->assertOk()
            ->assertJsonPath('name', 'Кофемания');
    }

    public function test_any_authenticated_user_can_view_an_organization_they_did_not_add(): void
    {
        $owner = User::factory()->create();
        $organization = Organization::factory()->for($owner)->create();
        $otherUser = User::factory()->create();

        $this->actingAs($otherUser, 'web')->fromFrontend()->getJson("/api/organizations/{$organization->id}")
            ->assertOk();

        $this->actingAs($otherUser, 'web')->fromFrontend()->getJson("/api/organizations/{$organization->id}/reviews")
            ->assertOk();
    }

    public function test_reviews_are_paginated_fifty_per_page(): void
    {
        $user = User::factory()->create();
        $organization = Organization::factory()->for($user)->create();
        Review::factory()->for($organization)->count(120)->create();

        $firstPage = $this->actingAs($user, 'web')->fromFrontend()
            ->getJson("/api/organizations/{$organization->id}/reviews")->assertOk();
        $firstPage->assertJsonCount(50, 'data');
        $this->assertSame(120, $firstPage->json('meta.total'));

        $secondPage = $this->actingAs($user, 'web')->fromFrontend()
            ->getJson("/api/organizations/{$organization->id}/reviews?page=3");
        $secondPage->assertJsonCount(20, 'data');
    }
}
