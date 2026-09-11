<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Organization;
use App\Models\OrganizationSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationSnapshot>
 */
class OrganizationSnapshotFactory extends Factory
{
    protected $model = OrganizationSnapshot::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'avg_rating' => $this->faker->randomFloat(2, 3, 5),
            'ratings_count' => $this->faker->numberBetween(50, 6000),
            'reviews_count' => $this->faker->numberBetween(10, 600),
            'diff_summary' => null,
            'captured_at' => now(),
        ];
    }
}
