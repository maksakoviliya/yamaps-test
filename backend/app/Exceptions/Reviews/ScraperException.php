<?php

declare(strict_types=1);

namespace App\Exceptions\Reviews;

abstract class ScraperException extends \RuntimeException
{
    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(string $message, public readonly array $details = [])
    {
        parent::__construct($message);
    }

    /**
     * @param  array<string, mixed>  $details
     */
    public static function forErrorCode(string $errorCode, string $message, array $details = []): self
    {
        return match ($errorCode) {
            'MARKUP_CHANGED' => new MarkupChangedException($message, $details),
            'EMPTY_RESPONSE' => new EmptyResponseException($message, $details),
            'BLOCKED' => new BlockedException($message, $details),
            'NOT_FOUND' => new NotFoundException($message, $details),
            'TIMEOUT' => new TimeoutException($message, $details),
            default => new PageUnavailableException($message, $details),
        };
    }
}
