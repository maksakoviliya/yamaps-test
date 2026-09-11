<script setup lang="ts">
import type { Organization } from '@/types'

defineProps<{
  organization: Organization
}>()

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div>
      <p class="text-xs text-[var(--muted-foreground)]">Рейтинг</p>
      <p class="text-2xl font-semibold">
        {{ organization.avg_rating !== null ? organization.avg_rating.toFixed(1) : '—' }}
        <span v-if="organization.avg_rating !== null" class="text-amber-500">★</span>
      </p>
    </div>
    <div>
      <p class="text-xs text-[var(--muted-foreground)]">Оценок</p>
      <p class="text-2xl font-semibold">{{ organization.ratings_count ?? '—' }}</p>
    </div>
    <div>
      <p class="text-xs text-[var(--muted-foreground)]">Отзывов</p>
      <p class="text-2xl font-semibold">{{ organization.reviews_count ?? '—' }}</p>
    </div>
    <div>
      <p class="text-xs text-[var(--muted-foreground)]">Обновлено</p>
      <p class="text-sm">{{ formatDate(organization.last_parsed_at) }}</p>
    </div>
  </div>
</template>
