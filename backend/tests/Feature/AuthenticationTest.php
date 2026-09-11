<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /** Sanctum only treats a request as stateful when Origin/Referer is in the stateful domains list. */
    private function fromFrontend(): static
    {
        return $this->withHeader('Origin', env('FRONTEND_URL', 'http://localhost:5173'));
    }

    public function test_user_can_login_with_correct_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'demo@example.com',
            'password' => bcrypt('password'),
        ]);

        $response = $this->fromFrontend()->postJson('/api/login', [
            'email' => 'demo@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()->assertJsonPath('email', 'demo@example.com');
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_user_cannot_login_with_wrong_password(): void
    {
        User::factory()->create([
            'email' => 'demo@example.com',
            'password' => bcrypt('password'),
        ]);

        $response = $this->fromFrontend()->postJson('/api/login', [
            'email' => 'demo@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertGuest('web');
    }

    public function test_login_requires_email_and_password(): void
    {
        $response = $this->fromFrontend()->postJson('/api/login', []);

        $response->assertStatus(422)->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_guest_cannot_access_current_user_endpoint(): void
    {
        $response = $this->fromFrontend()->getJson('/api/user');

        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_fetch_own_profile(): void
    {
        $user = User::factory()->create();

        // Explicit "web" guard: actingAs($user, null) corrupts default-guard
        // resolution for the rest of the test (breaks implicit Request::user()).
        $response = $this->actingAs($user, 'web')->fromFrontend()->getJson('/api/user');

        $response->assertOk()->assertJsonPath('id', $user->id);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromFrontend()->postJson('/api/logout')->assertOk();

        // Not a second /api/user call: Sanctum's RequestGuard caches its
        // resolved user for the guard's lifetime, and feature tests reuse one
        // app instance across calls, so a follow-up request would still read
        // as authenticated — a test-harness artifact, not real behaviour.
        $this->assertGuest('web');
    }
}
