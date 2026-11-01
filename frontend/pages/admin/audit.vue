<script setup lang="ts">
import { ScrollText } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const logs = ref<any[]>([])
const offset = ref(0)
const limit = 50
const noMore = ref(false)
const loading = ref(false)

async function loadMore() {
  if (loading.value || noMore.value) return
  loading.value = true
  try {
    const rows = await api<any[]>('/admin/audit-logs', { query: { limit, offset: offset.value } })
    logs.value.push(...rows)
    if (rows.length < limit) noMore.value = true
    offset.value += rows.length
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!admin.isLoggedIn) { navigateTo('/admin/login'); return }
  loadMore()
})
</script>

<template>
  <div class="page">
    <PageHeader title="审计日志" description="管理员操作记录，按时间倒序分页加载。" eyebrow="Audit">
      <template #icon><ScrollText :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <div class="card">
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead>
            <tr><th>#</th><th>时间</th><th>管理员</th><th>动作</th><th>目标</th><th>IP</th><th>参数</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in logs" :key="l.id">
              <td class="tabular">{{ l.id }}</td>
              <td class="nowrap">{{ l.happened_at }}</td>
              <td>{{ l.admin }}</td>
              <td><code class="code-inline">{{ l.action }}</code></td>
              <td><span v-if="l.target_type">{{ l.target_type }}/{{ l.target_id }}</span><span v-else>-</span></td>
              <td class="nowrap">{{ l.ip }}</td>
              <td><code class="code-inline" style="max-width:280px;display:inline-block;overflow:hidden;text-overflow:ellipsis">{{ l.params ? JSON.stringify(l.params) : '-' }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-if="!logs.length && !loading" title="暂无审计日志" />
      <div class="cluster" style="justify-content:center;padding:14px">
        <FButton v-if="!noMore && logs.length" appearance="outline" :loading="loading" @click="loadMore">{{ loading ? '加载中…' : '加载更多' }}</FButton>
        <span v-else-if="logs.length" class="muted" style="font-size:12px">没有更多了</span>
      </div>
    </div>
  </div>
</template>
