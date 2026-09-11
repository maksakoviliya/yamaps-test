<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import type { Organization } from '@/types'

const props = defineProps<{
  status: Organization['status']
  message: string
}>()

const variant = computed(() => {
  switch (props.status) {
    case 'ready':
      return 'success'
    case 'failed':
      return 'destructive'
    case 'blocked_retry':
      return 'warning'
    default:
      return 'secondary'
  }
})
</script>

<template>
  <Badge :variant="variant">{{ message }}</Badge>
</template>
