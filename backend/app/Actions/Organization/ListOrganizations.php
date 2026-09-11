<?php

declare(strict_types=1);

namespace App\Actions\Organization;

use App\Models\Organization;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class ListOrganizations
{
    public function __invoke(Request $request): LengthAwarePaginator
    {
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        return Organization::query()
            ->latest()
            ->paginate($perPage);
    }
}
