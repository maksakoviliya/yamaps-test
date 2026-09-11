<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import OrganizationStatusBadge from '@/components/OrganizationStatusBadge.vue'
import ParseProgress from '@/components/ParseProgress.vue'
import type { Organization } from '@/types'

defineProps<{ organization: Organization }>()
</script>

<template>
  <RouterLink :to="{ name: 'organization', params: { id: organization.id } }">
    <Card class="transition-colors hover:bg-[var(--accent)]">
      <CardContent class="flex flex-col gap-3 pt-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ organization.name ?? organization.url }}</p>
            <p class="truncate text-xs text-[var(--muted-foreground)]">{{ organization.url }}</p>
          </div>
          <OrganizationStatusBadge
            class="max-w-[45%]"
            :status="organization.status"
            :message="organization.status_message"
          />
        </div>

        <ParseProgress
          v-if="organization.status === 'parsing'"
          :current="organization.progress_current"
          :total="organization.progress_total"
        />

        <div v-else-if="organization.status === 'ready'" class="flex gap-4 text-sm text-[var(--muted-foreground)]">
          <span>★ {{ organization.avg_rating?.toFixed(1) ?? '—' }}</span>
          <span>{{ organization.ratings_count ?? '—' }} оценок</span>
          <span>{{ organization.reviews_count ?? '—' }} отзывов</span>
        </div>
      </CardContent>
    </Card>
  </RouterLink>
</template>
