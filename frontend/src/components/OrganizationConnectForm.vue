<script setup lang="ts">
import { ref } from 'vue'
import Alert from '@/components/ui/Alert.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useConnectOrganization } from '@/composables/useOrganizations'
import type { Organization } from '@/types'

const emit = defineEmits<{
  connected: [organization: Organization]
}>()

const url = ref('')
const { isSubmitting, error, connect } = useConnectOrganization()

async function handleSubmit(): Promise<void> {
  const organization = await connect(url.value)

  if (organization) {
    url.value = ''
    emit('connected', organization)
  }
}
</script>

<template>
  <form class="flex flex-col gap-3 sm:flex-row sm:items-start" @submit.prevent="handleSubmit">
    <div class="flex-1">
      <Input
        v-model="url"
        type="url"
        placeholder="https://yandex.ru/maps/org/.../..."
        required
        :disabled="isSubmitting"
      />
      <Alert v-if="error" variant="destructive" class="mt-2">{{ error }}</Alert>
    </div>
    <Button type="submit" :disabled="isSubmitting || url.length === 0">
      {{ isSubmitting ? 'Добавляем…' : 'Подключить' }}
    </Button>
  </form>
</template>
