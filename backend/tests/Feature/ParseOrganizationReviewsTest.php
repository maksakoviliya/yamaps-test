<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\OrganizationStatus;
use App\Exceptions\Reviews\BlockedException;
use App\Exceptions\Reviews\MarkupChangedException;
use App\Jobs\ParseOrganizationReviews;
use App\Models\Organization;
use App\Services\Reviews\ReviewDTO;
use App\Services\Reviews\ReviewsFetchResult;
use App\Services\Reviews\ReviewsProviderInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeReviewsProvider;
use Tests\TestCase;

class ParseOrganizationReviewsTest extends TestCase
{
    use RefreshDatabase;

    private function fetchResult(int $ratingsCount = 100, int $reviewsCount = 2): ReviewsFetchResult
    {
        return new ReviewsFetchResult(
            businessName: 'Кофемания',
            businessId: '1364580496',
            avgRating: 4.7,
            ratingsCount: $ratingsCount,
            reviewsCount: $reviewsCount,
            reviews: [
                new ReviewDTO('review-1', 'Ася', null, 5, 'Отлично', new \DateTimeImmutable('2026-01-01')),
                new ReviewDTO('review-2', 'Пётр', null, 3, 'Средне', new \DateTimeImmutable('2026-01-02')),
            ],
        );
    }

    private function runParseJob(Organization $organization): void
    {
        app()->call([new ParseOrganizationReviews($organization), 'handle']);
    }

    public function test_successful_parse_updates_organization_and_creates_reviews(): void
    {
        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider($this->fetchResult()));

        $organization = Organization::factory()->pending()->create();

        $this->runParseJob($organization);

        $organization->refresh();
        $this->assertSame(OrganizationStatus::Ready, $organization->status);
        $this->assertEquals(4.7, (float) $organization->avg_rating);
        $this->assertSame(100, $organization->ratings_count);
        $this->assertDatabaseCount('reviews', 2);
        $this->assertDatabaseCount('organization_snapshots', 1);
    }

    public function test_reparsing_with_the_same_data_does_not_duplicate_reviews_or_snapshots(): void
    {
        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider($this->fetchResult()));

        $organization = Organization::factory()->pending()->create();

        $this->runParseJob($organization);
        $this->runParseJob($organization->refresh());

        $this->assertDatabaseCount('reviews', 2);
        $this->assertDatabaseCount('organization_snapshots', 1);
    }

    public function test_reparsing_with_changed_aggregates_records_a_new_snapshot(): void
    {
        $organization = Organization::factory()->pending()->create();

        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider($this->fetchResult(ratingsCount: 100)));
        $this->runParseJob($organization);

        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider($this->fetchResult(ratingsCount: 150)));
        $this->runParseJob($organization->refresh());

        $this->assertDatabaseCount('organization_snapshots', 2);
        $latest = $organization->snapshots()->orderByDesc('captured_at')->orderByDesc('id')->first();
        $this->assertSame(['from' => 100, 'to' => 150], $latest->diff_summary['ratings_count']);
    }

    public function test_blocked_response_marks_organization_as_blocked_retry_and_rethrows(): void
    {
        $exception = new BlockedException('Яндекс заблокировал запрос.');
        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider(throws: $exception));

        $organization = Organization::factory()->pending()->create();

        try {
            $this->runParseJob($organization);
            $this->fail('Expected BlockedException to be thrown.');
        } catch (BlockedException) {
            // expected — Laravel's own retry/backoff handles this outside the test.
        }

        $organization->refresh();
        $this->assertSame(OrganizationStatus::BlockedRetry, $organization->status);
    }

    public function test_markup_changed_fails_the_organization_without_rethrowing(): void
    {
        $exception = new MarkupChangedException('Структура ответа изменилась.');
        $this->app->bind(ReviewsProviderInterface::class, fn () => new FakeReviewsProvider(throws: $exception));

        $organization = Organization::factory()->pending()->create();

        $this->runParseJob($organization);

        $organization->refresh();
        $this->assertSame(OrganizationStatus::Failed, $organization->status);
        $this->assertSame('Структура ответа изменилась.', $organization->last_error_message);
    }
}
