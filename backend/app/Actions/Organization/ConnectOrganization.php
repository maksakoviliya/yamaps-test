<?php

declare(strict_types=1);

namespace App\Actions\Organization;

use App\Enums\OrganizationStatus;
use App\Jobs\ParseOrganizationReviews;
use App\Models\Organization;
use App\Models\User;

class ConnectOrganization
{
    public function __invoke(User $user, string $url): Organization
    {
        $businessId = $this->extractBusinessId($url);

        $organization = Organization::query()->firstOrNew(
            $businessId !== null ? ['yandex_business_id' => $businessId] : ['url' => $url]
        );

        if ($organization->exists && $organization->status->isInProgress()) {
            return $organization;
        }

        $organization->fill([
            'user_id' => $organization->user_id ?? $user->id,
            'url' => $url,
            'status' => OrganizationStatus::Pending,
            'last_error_message' => null,
            'last_attempt' => 0,
            'progress_current' => null,
            'progress_total' => null,
        ])->save();

        ParseOrganizationReviews::dispatch($organization);

        return $organization;
    }

    private function extractBusinessId(string $url): ?string
    {
        return preg_match('#/org/[^/]+/(\d+)#', $url, $matches) === 1 ? $matches[1] : null;
    }
}
