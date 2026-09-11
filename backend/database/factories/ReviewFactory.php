<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Review;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    protected $model = Review::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'external_review_id' => $this->faker->unique()->uuid(),
            'author_name' => $this->faker->name(),
            'author_avatar_url' => null,
            'rating' => $this->faker->numberBetween(1, 5),
            'text' => $this->faker->paragraph(),
            'published_at' => $this->faker->dateTimeBetween('-2 years'),
            'raw_payload' => null,
        ];
    }
}
