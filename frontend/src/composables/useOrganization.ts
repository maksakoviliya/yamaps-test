import { onUnmounted, ref, watch } from 'vue'
import { api, extractErrorMessage } from '@/lib/api'
import type { Organization } from '@/types'

const POLL_INTERVAL_MS = 2000
const IN_PROGRESS_STATUSES = new Set(['pending', 'parsing', 'blocked_retry'])

export function useOrganization(id: string) {
  const organization = ref<Organization | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchOrganization(): Promise<void> {
    try {
      const { data } = await api.get<Organization>(`/api/organizations/${id}`)
      organization.value = data
      error.value = null
    } catch (caught) {
      error.value = extractErrorMessage(caught, 'Не удалось загрузить организацию.')
    } finally {
      isLoading.value = false
    }
  }

  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function startPolling(): void {
    stopPolling()
    timer = setInterval(fetchOrganization, POLL_INTERVAL_MS)
  }

  watch(
    () => organization.value?.status,
    (status) => {
      if (status && IN_PROGRESS_STATUSES.has(status)) {
        if (timer === null) startPolling()
      } else {
        stopPolling()
      }
    },
  )

  onUnmounted(stopPolling)

  fetchOrganization()

  return { organization, isLoading, error, refetch: fetchOrganization }
}
