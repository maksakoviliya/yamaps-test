import { ref } from 'vue'
import { api, extractErrorMessage } from '@/lib/api'
import type { PaginatedResponse, Review } from '@/types'

export function useReviews(organizationId: string) {
  const reviews = ref<Review[]>([])
  const currentPage = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPage(page = 1): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const { data } = await api.get<PaginatedResponse<Review>>(
        `/api/organizations/${organizationId}/reviews`,
        { params: { page } },
      )
      reviews.value = data.data
      currentPage.value = data.meta.current_page
      lastPage.value = data.meta.last_page
      total.value = data.meta.total
    } catch (caught) {
      error.value = extractErrorMessage(caught, 'Не удалось загрузить отзывы.')
    } finally {
      isLoading.value = false
    }
  }

  return { reviews, currentPage, lastPage, total, isLoading, error, fetchPage }
}
