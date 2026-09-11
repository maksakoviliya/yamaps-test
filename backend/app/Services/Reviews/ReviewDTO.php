<?php

declare(strict_types=1);

namespace App\Services\Reviews;

final readonly class ReviewDTO
{
    public function __construct(
        public string $externalReviewId,
        public string $authorName,
        public ?string $authorAvatarUrl,
        public ?int $rating,
        public string $text,
        public ?\DateTimeImmutable $publishedAt,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            externalReviewId: (string) $data['externalReviewId'],
            authorName: $data['authorName'] ?? 'Аноним',
            authorAvatarUrl: $data['authorAvatarUrl'] ?? null,
            rating: isset($data['rating']) ? (int) $data['rating'] : null,
            text: $data['text'] ?? '',
            publishedAt: self::parseDate($data['publishedAt'] ?? null),
        );
    }

    private static function parseDate(?string $value): ?\DateTimeImmutable
    {
        if ($value === null) {
            return null;
        }

        try {
            return new \DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }
}
