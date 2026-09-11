<?php

declare(strict_types=1);

namespace App\Services\Reviews;

use App\Exceptions\Reviews\ScraperException;

interface ReviewsProviderInterface
{
    /**
     * @param  callable(int $current, ?int $total): void  $onProgress
     *
     * @throws ScraperException
     */
    public function fetch(string $url, callable $onProgress): ReviewsFetchResult;
}
