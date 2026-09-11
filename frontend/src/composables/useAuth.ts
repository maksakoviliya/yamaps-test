import { computed, ref } from 'vue'
import { api, ensureCsrfCookie, extractErrorMessage } from '@/lib/api'
import type { User } from '@/types'

const user = ref<User | null>(null)
const isBootstrapping = ref(true)

async function fetchUser(): Promise<void> {
  try {
    const { data } = await api.get<User>('/api/user')
    user.value = data
  } catch {
    user.value = null
  } finally {
    isBootstrapping.value = false
  }
}

async function login(email: string, password: string): Promise<void> {
  await ensureCsrfCookie()

  try {
    const { data } = await api.post<User>('/api/login', { email, password })
    user.value = data
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Не удалось войти. Проверьте email и пароль.'))
  }
}

async function logout(): Promise<void> {
  await api.post('/api/logout')
  user.value = null
}

export function useAuth() {
  return {
    user,
    isBootstrapping,
    isAuthenticated: computed(() => user.value !== null),
    fetchUser,
    login,
    logout,
  }
}
