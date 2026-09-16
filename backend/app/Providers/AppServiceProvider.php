<?php

declare(strict_types=1);

namespace App\Providers;

use App\Services\Reviews\ReviewsProviderInterface;
use App\Services\Reviews\YandexMaps\ScraperProcessRunner;
use App\Services\Reviews\YandexMaps\YandexMapsReviewsProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ReviewsProviderInterface::class, fn ($app) => match (config('review_providers.active')) {
            'yandex' => $app->make(YandexMapsReviewsProvider::class),
            default => throw new \RuntimeException('Неизвестный провайдер отзывов: '.config('review_providers.active')),
        });

        $this->app->bind(ScraperProcessRunner::class, function (): ScraperProcessRunner {
            $config = $this->app['config']->get('scraper');

            return new ScraperProcessRunner(
                scriptPath: $config['script_path'],
                nodeBinary: $config['node_binary'],
                env: [
                    'SCRAPER_NAVIGATION_TIMEOUT_MS' => $config['navigation_timeout_ms'],
                    'SCRAPER_TOTAL_TIMEOUT_MS' => $config['total_timeout_ms'],
                    'SCRAPER_MIN_DELAY_MS' => $config['min_delay_ms'],
                    'SCRAPER_MAX_DELAY_MS' => $config['max_delay_ms'],
                    'SCRAPER_MAX_STALLED_SCROLLS' => $config['max_stalled_scrolls'],
                    'SCRAPER_USER_AGENTS' => $config['user_agents'],
                    'SCRAPER_PROXIES' => $config['proxies'],
                    'SCRAPER_HEADLESS' => $config['headless'] ? 'true' : 'false',
                ],
                timeoutSeconds: (int) ceil($config['total_timeout_ms'] / 1000) + 30,
            );
        });
    }

    public function boot(): void
    {
        JsonResource::withoutWrapping();

        RateLimiter::for(
            'yandex-scrape',
            fn () => Limit::perMinute((int) config('scraper.rate_limit_per_minute'))
        );
    }
}
