<script setup lang="ts">
import type { Review } from '@/types'

defineProps<{ review: Review }>()

function formatDate(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('ru-RU', { dateStyle: 'medium' })
}
</script>

<template>
  <article class="flex flex-col gap-2 border-b border-[var(--border)] py-4 last:border-0">
    <div class="flex items-center gap-3">
      <img
        v-if="review.author_avatar_url"
        :src="review.author_avatar_url.replace('{size}', '64x64')"
        :alt="review.author_name"
        class="h-8 w-8 rounded-full object-cover"
      />
      <div v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-medium">
        {{ review.author_name.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">{{ review.author_name }}</p>
        <p class="text-xs text-[var(--muted-foreground)]">{{ formatDate(review.published_at) }}</p>
      </div>
      <div v-if="review.rating !== null" class="text-sm text-amber-500">
        {{ '★'.repeat(review.rating) }}<span class="text-[var(--border)]">{{ '★'.repeat(5 - review.rating) }}</span>
      </div>
    </div>
    <p class="text-sm whitespace-pre-line">{{ review.text }}</p>
  </article>
</template>
