<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    public function definition(): array
    {
        $businessId = (string) $this->faker->unique()->numberBetween(1_000_000_000, 9_999_999_999);

        return [
            'user_id' => User::factory(),
            'yandex_url' => "https://yandex.ru/maps/org/{$businessId}/",
            'yandex_business_id' => $businessId,
            'name' => $this->faker->company(),
            'avg_rating' => $this->faker->randomFloat(2, 3, 5),
            'ratings_count' => $this->faker->numberBetween(50, 6000),
            'reviews_count' => $this->faker->numberBetween(10, 600),
            'status' => OrganizationStatus::Ready,
            'last_status_message' => null,
            'progress_current' => null,
            'progress_total' => null,
            'last_attempt' => 1,
            'last_error_message' => null,
            'last_parsed_at' => now(),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => OrganizationStatus::Pending,
            'avg_rating' => null,
            'ratings_count' => null,
            'reviews_count' => null,
            'last_parsed_at' => null,
        ]);
    }
}
