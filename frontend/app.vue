<script setup lang="ts">
// 只在客户端路由跳转（非 SSR 首屏）时显示骨架图。
const nuxtApp = useNuxtApp()
const routePending = ref(false)
let hydrated = false
let suspensePending = false
let showTimer: ReturnType<typeof setTimeout> | undefined
let stopTimer: ReturnType<typeof setTimeout> | undefined

function finish() {
  clearTimeout(showTimer)
  clearTimeout(stopTimer)
  routePending.value = false
}

onMounted(() => { hydrated = true })
onBeforeUnmount(() => { clearTimeout(showTimer); clearTimeout(stopTimer) })

if (import.meta.client) {
  const router = useRouter()
  router.beforeEach((to, from) => {
    // from.name 为空说明是首屏 hydration，交给 SSR 内容，不闪骨架。
    if (!hydrated || !from.name || to.fullPath === from.fullPath) return
    clearTimeout(stopTimer)
    showTimer = setTimeout(() => { routePending.value = true }, 80)
  })
  nuxtApp.hook('page:loading:start', () => { suspensePending = true })
  nuxtApp.hook('page:loading:end', () => { suspensePending = false; finish() })
  router.afterEach(() => {
    clearTimeout(showTimer)
    // Suspense 未挂起时 end 不会触发，短延时收尾；挂起时给一个较长的兜底。
    stopTimer = setTimeout(finish, suspensePending ? 4000 : 90)
  })
}
</script>

<template>
  <NuxtLayout>
    <div v-show="!routePending" class="route-page"><NuxtPage /></div>
    <RouteSkeleton v-if="routePending" />
  </NuxtLayout>
</template>

<style scoped>
.route-page { min-width: 0; }
</style>
