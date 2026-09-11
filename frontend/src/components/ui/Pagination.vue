<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  currentPage: number
  lastPage: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

function go(page: number): void {
  if (page < 1 || page > props.lastPage || page === props.currentPage) return
  emit('change', page)
}
</script>

<template>
  <div v-if="lastPage > 1" class="flex items-center justify-center gap-3">
    <Button variant="outline" size="sm" :disabled="disabled || currentPage <= 1" @click="go(currentPage - 1)">
      Назад
    </Button>
    <span class="text-sm text-[var(--muted-foreground)]">Страница {{ currentPage }} из {{ lastPage }}</span>
    <Button variant="outline" size="sm" :disabled="disabled || currentPage >= lastPage" @click="go(currentPage + 1)">
      Вперёд
    </Button>
  </div>
</template>
