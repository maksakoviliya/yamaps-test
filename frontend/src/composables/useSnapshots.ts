import { ref } from 'vue'
import { api, extractErrorMessage } from '@/lib/api'
import type { OrganizationSnapshot } from '@/types'

export function useSnapshots(organizationId: string) {
  const snapshots = ref<OrganizationSnapshot[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSnapshots(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const { data } = await api.get<OrganizationSnapshot[]>(
        `/api/organizations/${organizationId}/snapshots`,
      )
      snapshots.value = data
    } catch (caught) {
      error.value = extractErrorMessage(caught, 'Не удалось загрузить историю изменений.')
    } finally {
      isLoading.value = false
    }
  }

  return { snapshots, isLoading, error, fetchSnapshots }
}
