<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('animate-pulse rounded-[var(--radius)] bg-[var(--secondary)]', $props.class)" />
</template>
