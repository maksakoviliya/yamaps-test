<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Organization
 */
class OrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'name' => $this->name,
            'avg_rating' => $this->avg_rating !== null ? (float) $this->avg_rating : null,
            'ratings_count' => $this->ratings_count,
            'reviews_count' => $this->reviews_count,
            'status' => $this->status->value,
            'status_message' => $this->status->message(),
            'error_message' => $this->last_error_message,
            'progress_current' => $this->progress_current,
            'progress_total' => $this->progress_total,
            'last_parsed_at' => $this->last_parsed_at?->toIso8601String(),
        ];
    }
}
