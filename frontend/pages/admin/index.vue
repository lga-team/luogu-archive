<script setup lang="ts">
import { Activity, LayoutDashboard } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const stats = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  if (!admin.isLoggedIn) { navigateTo('/admin/login'); return }
  try {
    stats.value = await api<any>('/admin/stats')
  } catch (e: any) {
    if (e?.status === 401) navigateTo('/admin/login')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <PageHeader title="仪表盘" description="爬虫健康看板（近 24 小时）。" eyebrow="Dashboard">
      <template #icon><LayoutDashboard :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span v-if="stats?.now" class="meta-item">数据刷新时间：{{ stats.now }}</span>
      </template>
    </PageHeader>

    <LoadingPanel v-if="loading" variant="cards" :rows="3" title="正在加载看板" />

    <template v-else-if="stats">
      <div class="grid grid--3">
        <section class="card">
          <div class="card__header"><div><h2 class="card__title">按任务状态</h2><p class="card__description">近 24 小时任务</p></div><Activity :size="16" class="muted" aria-hidden="true" /></div>
          <div class="card__body">
            <div v-for="(v, k) in stats.by_status" :key="k" class="stat-row"><span class="muted">{{ k }}</span><strong class="tabular">{{ v }}</strong></div>
            <p v-if="!Object.keys(stats.by_status || {}).length" class="muted" style="font-size:13px">暂无数据</p>
          </div>
        </section>
        <section class="card">
          <div class="card__header"><h2 class="card__title">按任务类型</h2></div>
          <div class="card__body">
            <div v-for="(v, k) in stats.by_task_type" :key="k" class="stat-row"><span class="muted">{{ k }}</span><strong class="tabular">{{ v }}</strong></div>
            <p v-if="!Object.keys(stats.by_task_type || {}).length" class="muted" style="font-size:13px">暂无数据</p>
          </div>
        </section>
        <section class="card">
          <div class="card__header"><h2 class="card__title">队列长度</h2><p class="card__description">待消费任务</p></div>
          <div class="card__body">
            <div v-for="(v, k) in stats.queue_lengths" :key="k" class="stat-row"><span class="muted">{{ k }}</span><strong class="tabular">{{ v }}</strong></div>
            <p v-if="!Object.keys(stats.queue_lengths || {}).length" class="muted" style="font-size:13px">暂无数据</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--colorNeutralStroke2); font-size: 13px; }
.stat-row:last-child { border-bottom: 0; }
</style>
