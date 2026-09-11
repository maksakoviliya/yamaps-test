<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();

            $table->string('external_review_id');
            $table->string('author_name');
            $table->string('author_avatar_url')->nullable();
            $table->unsignedTinyInteger('rating');
            $table->text('text')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->json('raw_payload')->nullable();

            $table->timestamps();

            $table->unique(['organization_id', 'external_review_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
