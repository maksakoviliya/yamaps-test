<script setup lang="ts">
import { onMounted } from 'vue'
import Alert from '@/components/ui/Alert.vue'
import Pagination from '@/components/ui/Pagination.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ReviewItem from '@/components/ReviewItem.vue'
import { useReviews } from '@/composables/useReviews'

const props = defineProps<{ organizationId: string }>()

const { reviews, currentPage, lastPage, total, isLoading, error, fetchPage } = useReviews(props.organizationId)

onMounted(() => fetchPage(1))
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="total > 0" class="text-sm text-[var(--muted-foreground)]">Всего отзывов: {{ total }}</p>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="isLoading" class="flex flex-col gap-3">
      <Skeleton v-for="n in 5" :key="n" class="h-20 w-full" />
    </div>

    <p v-else-if="reviews.length === 0 && !error" class="text-sm text-[var(--muted-foreground)]">Отзывов пока нет.</p>

    <div v-else class="flex flex-col">
      <ReviewItem v-for="review in reviews" :key="review.id" :review="review" />
    </div>

    <Pagination :current-page="currentPage" :last-page="lastPage" :disabled="isLoading" @change="fetchPage" />
  </div>
</template>
