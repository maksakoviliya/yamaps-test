<?php

declare(strict_types=1);

return [

    'script_path' => base_path('scraper/scrape.js'),
    'node_binary' => env('SCRAPER_NODE_BINARY', 'node'),

    'max_reviews' => (int) env('SCRAPER_MAX_REVIEWS', 600),
    'navigation_timeout_ms' => (int) env('SCRAPER_NAVIGATION_TIMEOUT_MS', 30_000),
    'total_timeout_ms' => (int) env('SCRAPER_TOTAL_TIMEOUT_MS', 180_000),
    'min_delay_ms' => (int) env('SCRAPER_MIN_DELAY_MS', 700),
    'max_delay_ms' => (int) env('SCRAPER_MAX_DELAY_MS', 1_800),
    'max_stalled_scrolls' => (int) env('SCRAPER_MAX_STALLED_SCROLLS', 6),

    'user_agents' => env('SCRAPER_USER_AGENTS', ''),
    'proxies' => env('SCRAPER_PROXIES', ''),
    'headless' => env('SCRAPER_HEADLESS', true),

    'rate_limit_per_minute' => (int) env('SCRAPER_RATE_LIMIT_PER_MINUTE', 3),
];
