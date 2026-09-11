<?php

declare(strict_types=1);

namespace App\Services\Reviews;

final readonly class ReviewsFetchResult
{
    /**
     * @param  ReviewDTO[]  $reviews
     */
    public function __construct(
        public ?string $businessName,
        public ?string $businessId,
        public ?float $avgRating,
        public ?int $ratingsCount,
        public ?int $reviewsCount,
        public array $reviews,
    ) {}
}
