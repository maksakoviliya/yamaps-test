<script setup lang="ts">
import { onMounted } from 'vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useSnapshots } from '@/composables/useSnapshots'

const props = defineProps<{ organizationId: string }>()

const { snapshots, isLoading, fetchSnapshots } = useSnapshots(props.organizationId)

const fieldLabels: Record<string, string> = {
  avg_rating: 'Рейтинг',
  ratings_count: 'Оценок',
  reviews_count: 'Отзывов',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(fetchSnapshots)
</script>

<template>
  <div v-if="isLoading" class="flex flex-col gap-2">
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-10 w-full" />
  </div>

  <p v-else-if="snapshots.length === 0" class="text-sm text-[var(--muted-foreground)]">
    Изменений пока не зафиксировано.
  </p>

  <ul v-else class="flex flex-col gap-3">
    <li v-for="snapshot in snapshots" :key="snapshot.id" class="text-sm">
      <span class="text-[var(--muted-foreground)]">{{ formatDate(snapshot.captured_at) }}</span>
      <template v-if="snapshot.diff_summary">
        <span v-for="(change, field) in snapshot.diff_summary" :key="field" class="ml-2">
          {{ fieldLabels[field] ?? field }}: {{ change.from ?? '—' }} → {{ change.to ?? '—' }}
        </span>
      </template>
      <span v-else class="ml-2 text-[var(--muted-foreground)]">первый снимок</span>
    </li>
  </ul>
</template>
