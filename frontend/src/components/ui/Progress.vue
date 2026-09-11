<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number | null
  max?: number | null
}>()

const percent = computed(() => {
  if (props.value === null || !props.max) return null
  return Math.min(100, Math.round((props.value / props.max) * 100))
})
</script>

<template>
  <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
    <div
      class="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
      :class="{ 'animate-pulse': percent === null }"
      :style="{ width: `${percent ?? 35}%` }"
    />
  </div>
</template>
