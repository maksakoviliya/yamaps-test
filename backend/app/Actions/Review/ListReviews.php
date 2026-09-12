<?php

declare(strict_types=1);

namespace App\Actions\Review;

use App\Models\Organization;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ListReviews
{
    public function __invoke(Organization $organization, Request $request): LengthAwarePaginator
    {
        $perPage = min(max($request->integer('per_page', 10), 1), 100);

        return $organization->reviews()
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }
}
