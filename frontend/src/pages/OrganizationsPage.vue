<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Alert from '@/components/ui/Alert.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import AppHeader from '@/components/AppHeader.vue'
import OrganizationCard from '@/components/OrganizationCard.vue'
import OrganizationConnectForm from '@/components/OrganizationConnectForm.vue'
import { useOrganizations } from '@/composables/useOrganizations'
import type { Organization } from '@/types'

const { organizations, isLoading, error, fetchOrganizations } = useOrganizations()
const router = useRouter()

function onConnected(organization: Organization): void {
  router.push({ name: 'organization', params: { id: organization.id } })
}

onMounted(fetchOrganizations)
</script>

<template>
  <AppHeader />

  <main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
    <OrganizationConnectForm @connected="onConnected" />

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="isLoading" class="flex flex-col gap-3">
      <Skeleton v-for="n in 3" :key="n" class="h-24 w-full" />
    </div>

    <p v-else-if="organizations.length === 0" class="text-sm text-[var(--muted-foreground)]">
      Пока ни одна организация не подключена — вставьте ссылку на карточку Яндекс.Карт выше.
    </p>

    <div v-else class="flex flex-col gap-3">
      <OrganizationCard v-for="organization in organizations" :key="organization.id" :organization="organization" />
    </div>
  </main>
</template>
