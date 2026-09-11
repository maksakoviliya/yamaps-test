<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Alert from '@/components/ui/Alert.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppHeader from '@/components/AppHeader.vue'
import OrganizationStatusBadge from '@/components/OrganizationStatusBadge.vue'
import OrganizationSummary from '@/components/OrganizationSummary.vue'
import ParseProgress from '@/components/ParseProgress.vue'
import ReviewsList from '@/components/ReviewsList.vue'
import SnapshotHistory from '@/components/SnapshotHistory.vue'
import { useOrganization } from '@/composables/useOrganization'

const props = defineProps<{ id: string }>()

const { organization, isLoading, error } = useOrganization(props.id)
</script>

<template>
  <AppHeader />

  <main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
    <RouterLink :to="{ name: 'organizations' }" class="text-sm text-[var(--muted-foreground)] hover:underline">
      ← Ко всем организациям
    </RouterLink>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="isLoading" class="flex flex-col gap-3">
      <Skeleton class="h-32 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else-if="organization">
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <CardTitle class="truncate">{{ organization.name ?? organization.url }}</CardTitle>
              <a :href="organization.url" target="_blank" rel="noopener" class="block truncate text-xs text-[var(--muted-foreground)] hover:underline">
                {{ organization.url }}
              </a>
            </div>
            <OrganizationStatusBadge
              class="max-w-[45%] text-right"
              :status="organization.status"
              :message="organization.status_message"
            />
          </div>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <ParseProgress
            v-if="organization.status === 'parsing' || organization.status === 'pending'"
            :current="organization.progress_current"
            :total="organization.progress_total"
          />

          <Alert v-if="organization.status === 'failed' && organization.error_message" variant="destructive">
            {{ organization.error_message }}
          </Alert>

          <OrganizationSummary v-if="organization.status === 'ready'" :organization="organization" />
        </CardContent>
      </Card>

      <template v-if="organization.status === 'ready'">
        <Card>
          <CardHeader>
            <CardTitle>Отзывы</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewsList :organization-id="organization.id" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История изменений</CardTitle>
          </CardHeader>
          <CardContent>
            <SnapshotHistory :organization-id="organization.id" />
          </CardContent>
        </Card>
      </template>
    </template>
  </main>
</template>
