<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\OrganizationSnapshot;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizationSnapshot
 */
class OrganizationSnapshotResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'avg_rating' => $this->avg_rating !== null ? (float) $this->avg_rating : null,
            'ratings_count' => $this->ratings_count,
            'reviews_count' => $this->reviews_count,
            'diff_summary' => $this->diff_summary,
            'captured_at' => $this->captured_at->toIso8601String(),
        ];
    }
}
