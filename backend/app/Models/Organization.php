<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OrganizationStatus;
use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id',
        'url',
        'yandex_business_id',
        'name',
        'avg_rating',
        'ratings_count',
        'reviews_count',
        'status',
        'progress_current',
        'progress_total',
        'last_attempt',
        'last_error_message',
        'last_parsed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrganizationStatus::class,
            'avg_rating' => 'decimal:2',
            'last_parsed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function snapshots(): HasMany
    {
        return $this->hasMany(OrganizationSnapshot::class);
    }
}
