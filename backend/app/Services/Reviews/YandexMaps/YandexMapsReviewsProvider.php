<?php

declare(strict_types=1);

namespace App\Services\Reviews\YandexMaps;

use App\Services\Reviews\ReviewDTO;
use App\Services\Reviews\ReviewsFetchResult;
use App\Services\Reviews\ReviewsProviderInterface;

readonly class YandexMapsReviewsProvider implements ReviewsProviderInterface
{
    public function __construct(private ScraperProcessRunner $runner) {}

    public function fetch(string $url, callable $onProgress): ReviewsFetchResult
    {
        $payload = $this->runner->run($url, $onProgress);
        $business = $payload['business'] ?? [];

        return new ReviewsFetchResult(
            businessName: $business['name'] ?? null,
            businessId: $business['businessId'] ?? null,
            avgRating: isset($business['avgRating']) ? (float) $business['avgRating'] : null,
            ratingsCount: isset($business['ratingsCount']) ? (int) $business['ratingsCount'] : null,
            reviewsCount: isset($business['reviewsCount']) ? (int) $business['reviewsCount'] : null,
            reviews: array_map(ReviewDTO::fromArray(...), $payload['reviews'] ?? []),
        );
    }
}
