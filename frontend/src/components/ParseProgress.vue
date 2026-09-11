<script setup lang="ts">
import Progress from '@/components/ui/Progress.vue'

defineProps<{
  current: number | null
  total: number | null
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Progress :value="current" :max="total" />
    <p class="text-xs text-[var(--muted-foreground)]">
      <template v-if="current !== null && total">Собрано {{ current }} из {{ total }} отзывов</template>
      <template v-else>Загружаем данные…</template>
    </p>
  </div>
</template>
