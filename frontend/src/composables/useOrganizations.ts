import { ref } from 'vue'
import { api, extractErrorMessage } from '@/lib/api'
import type { Organization, PaginatedResponse } from '@/types'

export function useOrganizations() {
  const organizations = ref<Organization[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchOrganizations(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const { data } = await api.get<PaginatedResponse<Organization>>('/api/organizations')
      organizations.value = data.data
    } catch (caught) {
      error.value = extractErrorMessage(caught, 'Не удалось загрузить список организаций.')
    } finally {
      isLoading.value = false
    }
  }

  return { organizations, isLoading, error, fetchOrganizations }
}

export function useConnectOrganization() {
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  async function connect(url: string): Promise<Organization | null> {
    isSubmitting.value = true
    error.value = null

    try {
      const { data } = await api.post<Organization>('/api/organizations', { url })
      return data
    } catch (caught) {
      error.value = extractErrorMessage(caught, 'Не удалось подключить организацию.')
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  return { isSubmitting, error, connect }
}
