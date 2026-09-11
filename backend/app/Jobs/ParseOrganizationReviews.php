<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\OrganizationStatus;
use App\Exceptions\Reviews\BlockedException;
use App\Exceptions\Reviews\MarkupChangedException;
use App\Exceptions\Reviews\NotFoundException;
use App\Exceptions\Reviews\ScraperException;
use App\Models\Organization;
use App\Services\Reviews\OrganizationSyncService;
use App\Services\Reviews\ReviewsProviderInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;

class ParseOrganizationReviews implements ShouldQueue
{
    use InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public readonly Organization $organization)
    {
        $this->onQueue('scraping');
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [30, 120, 300];
    }

    /**
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping($this->organization->id))->releaseAfter(30),
            new RateLimited('yandex-scrape'),
        ];
    }

    public function handle(ReviewsProviderInterface $provider, OrganizationSyncService $sync): void
    {
        $this->organization->update([
            'status' => OrganizationStatus::Parsing,
            'last_attempt' => $this->attempts(),
            'progress_current' => 0,
            'progress_total' => null,
        ]);

        try {
            $result = $provider->fetch($this->organization->url, function (int $current, ?int $total): void {
                $this->organization->update([
                    'progress_current' => $current,
                    'progress_total' => $total,
                ]);
            });

            $sync->sync($this->organization, $result);
        } catch (MarkupChangedException|NotFoundException $e) {
            $this->markFailed($e);
            $this->fail($e);

            return;
        } catch (BlockedException $e) {
            $this->organization->update([
                'status' => OrganizationStatus::BlockedRetry,
                'last_error_message' => $e->getMessage(),
            ]);

            Log::channel('scraper')->warning('Яндекс заблокировал запрос парсинга', [
                'organization_id' => $this->organization->id,
                'attempt' => $this->attempts(),
                'details' => $e->details,
            ]);

            throw $e;
        } catch (ScraperException $e) {
            $this->markFailed($e);

            throw $e;
        }
    }

    public function failed(\Throwable $e): void
    {
        $this->markFailed($e);
    }

    private function markFailed(\Throwable $e): void
    {
        $this->organization->update([
            'status' => OrganizationStatus::Failed,
            'last_error_message' => $e->getMessage(),
        ]);

        Log::channel('scraper')->error('Парсинг организации завершился ошибкой', [
            'organization_id' => $this->organization->id,
            'attempt' => $this->attempts(),
            'exception' => $e::class,
            'message' => $e->getMessage(),
            'details' => $e instanceof ScraperException ? $e->details : [],
        ]);
    }
}
