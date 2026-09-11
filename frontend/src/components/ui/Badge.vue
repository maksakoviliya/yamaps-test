<script setup lang="ts">
import { cn } from '@/lib/cn'

withDefaults(
  defineProps<{
    variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'
  }>(),
  { variant: 'default' },
)

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--secondary)] text-[var(--secondary-foreground)]',
  secondary: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-center text-xs font-medium',
        variantClasses[variant],
      )
    "
  >
    <slot />
  </span>
</template>
