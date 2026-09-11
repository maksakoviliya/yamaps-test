<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidBusinessUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $host = is_string($value) ? parse_url($value, PHP_URL_HOST) : null;
        $path = is_string($value) ? parse_url($value, PHP_URL_PATH) : null;

        $provider = config('review_providers.providers.'.config('review_providers.active'));

        $matches = $host !== null && $path !== null
            && preg_match($provider['host_pattern'], $host) === 1
            && preg_match($provider['path_pattern'], $path) === 1;

        if (! $matches) {
            $fail(__('validation.custom.url.unsupported_provider'));
        }
    }
}
