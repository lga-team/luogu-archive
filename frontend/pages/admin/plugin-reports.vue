<script setup lang="ts">
import { Flag } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const status = ref('pending')
const rows = ref<any[]>([])
const typeNames: Record<string, string> = { dangerous_request: '危险请求', malicious_code: '恶意代码', broken: '失效', copyright: '侵权', misleading: '信息不实', other: '其他' }
const statusNames: Record<string, string> = { pending: '待处理', resolved: '已解决', dismissed: '已驳回' }
const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已解决' },
  { value: 'dismissed', label: '已驳回' },
  { value: 'all', label: '全部' },
]
async function load() { rows.value = await api<any[]>('/admin/plugin-reports', { query: { status: status.value } }) }
async function handle(id: number, next: 'resolved' | 'dismissed') {
  const note = prompt('处理备注（可留空）：') || ''
  await api(`/admin/plugin-reports/${id}/handle`, { method: 'POST', body: { status: next, admin_note: note } })
  await load()
}
onMounted(async () => {
  if (!admin.isLoggedIn) return navigateTo('/admin/login')
  await load()
})
watch(status, () => void load())
</script>

<template>
  <div class="page">
    <PageHeader title="插件举报" description="处理用户对插件代码与请求行为的举报。" eyebrow="Reports">
      <template #icon><Flag :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FSelect v-model="status" :options="statusOptions" size="small" style="width:150px" aria-label="举报状态" />
      </template>
    </PageHeader>

    <div v-if="rows.length" class="report-list">
      <article v-for="row in rows" :key="row.id" class="card report-card">
        <div class="cluster" style="justify-content:space-between">
          <div class="cluster">
            <strong>#{{ row.id }} {{ typeNames[row.report_type] || row.report_type }}</strong>
            <span class="tag" :class="row.status === 'resolved' ? 'tag--success' : row.status === 'dismissed' ? 'tag' : 'tag--warn'">{{ statusNames[row.status] || row.status }}</span>
          </div>
          <span class="muted" style="font-size:11px">{{ row.created_at }}</span>
        </div>
        <p class="report-desc">{{ row.description }}</p>
        <div class="cluster" style="justify-content:space-between">
          <span class="muted" style="font-size:12px">插件 #{{ row.plugin_id }} · 举报人 #{{ row.reporter_user_id }}</span>
          <div class="cluster">
            <NuxtLink :to="`/plugin/${row.article_id}`" target="_blank" class="muted" style="font-size:12px">查看插件</NuxtLink>
            <template v-if="row.status === 'pending'">
              <FButton appearance="subtle" size="small" @click="handle(row.id, 'dismissed')">驳回</FButton>
              <FButton appearance="primary" size="small" @click="handle(row.id, 'resolved')">标记解决</FButton>
            </template>
          </div>
        </div>
      </article>
    </div>
    <EmptyState v-else title="暂无举报" description="当前筛选条件下没有插件举报。" />
  </div>
</template>

<style scoped>
.report-list { display: flex; flex-direction: column; gap: 10px; }
.report-card { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.report-desc { white-space: pre-wrap; color: var(--colorNeutralForeground2); font-size: 13px; line-height: 1.65; }
</style>
