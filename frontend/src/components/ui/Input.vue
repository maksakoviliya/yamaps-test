<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{
  modelValue: string
  type?: string
  placeholder?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :value="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    :class="
      cn(
        'flex h-9 w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent px-3 text-sm',
        'placeholder:text-[var(--muted-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )
    "
  />
</template>
