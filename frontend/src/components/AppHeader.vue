<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'

const { user, logout } = useAuth()
const router = useRouter()

async function handleLogout(): Promise<void> {
  await logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-8">
    <RouterLink :to="{ name: 'organizations' }" class="font-semibold">Отзывы на Яндекс.Картах</RouterLink>
    <div class="flex items-center gap-3">
      <span class="hidden text-sm text-[var(--muted-foreground)] sm:inline">{{ user?.email }}</span>
      <Button variant="outline" size="sm" @click="handleLogout">Выйти</Button>
    </div>
  </header>
</template>
