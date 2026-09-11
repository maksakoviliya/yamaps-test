<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm', $props.class)">
    <slot />
  </div>
</template>
