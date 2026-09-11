import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      name: 'organizations',
      component: () => import('@/pages/OrganizationsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/organizations/:id',
      name: 'organization',
      component: () => import('@/pages/OrganizationDetailPage.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
  ],
})

router.beforeEach(async (to) => {
  const { isAuthenticated, isBootstrapping, fetchUser } = useAuth()

  if (isBootstrapping.value) {
    await fetchUser()
  }

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && isAuthenticated.value) {
    return { name: 'organizations' }
  }

  return true
})

export default router
