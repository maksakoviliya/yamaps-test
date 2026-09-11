<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Reviews\ReviewsFetchResult;
use App\Services\Reviews\ReviewsProviderInterface;
use Throwable;

class FakeReviewsProvider implements ReviewsProviderInterface
{
    public function __construct(
        private readonly ?ReviewsFetchResult $result = null,
        private readonly ?Throwable $throws = null,
    ) {}

    public function fetch(string $url, callable $onProgress): ReviewsFetchResult
    {
        $onProgress(0, 2);

        if ($this->throws) {
            throw $this->throws;
        }

        $onProgress(2, 2);

        return $this->result;
    }
}
