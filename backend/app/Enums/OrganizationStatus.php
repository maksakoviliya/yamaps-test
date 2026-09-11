<?php

declare(strict_types=1);

namespace App\Enums;

enum OrganizationStatus: string
{
    case Pending = 'pending';
    case Parsing = 'parsing';
    case Ready = 'ready';
    case BlockedRetry = 'blocked_retry';
    case Failed = 'failed';

    public function message(): string
    {
        return __('scraper.status.'.$this->value);
    }

    public function isInProgress(): bool
    {
        return match ($this) {
            self::Pending, self::Parsing, self::BlockedRetry => true,
            self::Ready, self::Failed => false,
        };
    }
}
