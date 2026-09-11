<?php

declare(strict_types=1);

namespace App\Services\Reviews;

use App\Enums\OrganizationStatus;
use App\Models\Organization;
use App\Models\Review;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class OrganizationSyncService
{
    public function sync(Organization $organization, ReviewsFetchResult $result): void
    {
        DB::transaction(function () use ($organization, $result): void {
            $this->upsertReviews($organization, $result->reviews);

            $before = $organization->only(['avg_rating', 'ratings_count', 'reviews_count']);

            $organization->update([
                'name' => $result->businessName ?? $organization->name,
                'yandex_business_id' => $result->businessId ?? $organization->yandex_business_id,
                'avg_rating' => $result->avgRating,
                'ratings_count' => $result->ratingsCount,
                'reviews_count' => $result->reviewsCount,
                'status' => OrganizationStatus::Ready,
                'last_error_message' => null,
                'progress_current' => null,
                'progress_total' => null,
                'last_parsed_at' => now(),
            ]);

            $this->recordSnapshotIfChanged($organization, $before);
        });
    }

    /**
     * @param  ReviewDTO[]  $reviews
     */
    private function upsertReviews(Organization $organization, array $reviews): void
    {
        $reviews = array_filter($reviews, fn (ReviewDTO $review): bool => $review->rating !== null);

        if ($reviews === []) {
            return;
        }

        $this->logChangedReviews($organization, $reviews);

        $rows = array_map(fn (ReviewDTO $review): array => [
            'id' => (string) Str::ulid(),
            'organization_id' => $organization->id,
            'external_review_id' => $review->externalReviewId,
            'author_name' => $review->authorName,
            'author_avatar_url' => $review->authorAvatarUrl,
            'rating' => $review->rating,
            'text' => $review->text,
            'published_at' => $review->publishedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ], $reviews);

        foreach (array_chunk($rows, 200) as $chunk) {
            Review::query()->upsert(
                $chunk,
                uniqueBy: ['organization_id', 'external_review_id'],
                update: ['author_name', 'author_avatar_url', 'rating', 'text', 'published_at', 'updated_at'],
            );
        }
    }

    /**
     * @param  ReviewDTO[]  $reviews
     */
    private function logChangedReviews(Organization $organization, array $reviews): void
    {
        $existing = $organization->reviews()
            ->whereIn('external_review_id', array_map(fn (ReviewDTO $r): string => $r->externalReviewId, $reviews))
            ->get(['external_review_id', 'rating', 'text'])
            ->keyBy('external_review_id');

        foreach ($reviews as $review) {
            $previous = $existing->get($review->externalReviewId);

            if ($previous && ($previous->rating !== $review->rating || $previous->text !== $review->text)) {
                Log::channel('scraper')->info('Отзыв изменился при повторном парсинге', [
                    'organization_id' => $organization->id,
                    'external_review_id' => $review->externalReviewId,
                    'rating' => ['from' => $previous->rating, 'to' => $review->rating],
                ]);
            }
        }
    }

    /**
     * @param  array{avg_rating: mixed, ratings_count: mixed, reviews_count: mixed}  $before
     */
    private function recordSnapshotIfChanged(Organization $organization, array $before): void
    {
        $after = $organization->only(['avg_rating', 'ratings_count', 'reviews_count']);
        $diff = $this->diff($before, $after);

        $isFirstSnapshot = ! $organization->snapshots()->exists();

        if ($isFirstSnapshot || $diff !== []) {
            $organization->snapshots()->create([
                'avg_rating' => $after['avg_rating'],
                'ratings_count' => $after['ratings_count'],
                'reviews_count' => $after['reviews_count'],
                'diff_summary' => $diff !== [] ? $diff : null,
                'captured_at' => now(),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array<string, array{from: mixed, to: mixed}>
     */
    private function diff(array $before, array $after): array
    {
        $changed = [];

        foreach ($after as $key => $value) {
            if ((string) ($before[$key] ?? '') !== (string) $value) {
                $changed[$key] = ['from' => $before[$key] ?? null, 'to' => $value];
            }
        }

        return $changed;
    }
}
