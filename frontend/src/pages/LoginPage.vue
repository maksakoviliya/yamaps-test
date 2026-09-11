<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Alert from '@/components/ui/Alert.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import CardDescription from '@/components/ui/CardDescription.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import Input from '@/components/ui/Input.vue'
import { useAuth } from '@/composables/useAuth'

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const isSubmitting = ref(false)

const { login } = useAuth()
const router = useRouter()
const route = useRoute()

async function handleSubmit(): Promise<void> {
  error.value = null
  isSubmitting.value = true

  try {
    await login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Не удалось войти.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
        <CardDescription>Отзывы и рейтинг организаций на Яндекс.Картах</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-1.5">
            <label for="email" class="text-sm font-medium">Email</label>
            <Input id="email" v-model="email" type="email" placeholder="demo@example.com" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="password" class="text-sm font-medium">Пароль</label>
            <Input id="password" v-model="password" type="password" placeholder="••••••••" required />
          </div>

          <Alert v-if="error" variant="destructive">{{ error }}</Alert>

          <Button type="submit" :disabled="isSubmitting" class="w-full">
            {{ isSubmitting ? 'Входим…' : 'Войти' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
