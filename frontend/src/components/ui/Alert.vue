<script setup lang="ts">
import { cn } from '@/lib/cn'

withDefaults(
  defineProps<{
    variant?: 'default' | 'destructive'
  }>(),
  { variant: 'default' },
)

const variantClasses: Record<string, string> = {
  default: 'border-[var(--border)] text-[var(--foreground)]',
  destructive: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}
</script>

<template>
  <div :class="cn('rounded-[var(--radius)] border px-4 py-3 text-sm', variantClasses[variant])" role="alert">
    <slot />
  </div>
</template>
