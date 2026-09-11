<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\OrganizationSnapshotFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationSnapshot extends Model
{
    /** @use HasFactory<OrganizationSnapshotFactory> */
    use HasFactory, HasUlids;

    protected $fillable = [
        'organization_id',
        'avg_rating',
        'ratings_count',
        'reviews_count',
        'diff_summary',
        'captured_at',
    ];

    protected function casts(): array
    {
        return [
            'avg_rating' => 'decimal:2',
            'diff_summary' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
