<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const status = ref('pending')
const rows = ref<any[]>([])
const statusOptions = [{ value: 'pending', label: '待处理' }, { value: 'all', label: '全部' }]

async function load() { rows.value = await api<any[]>('/admin/takedowns', { query: { status: status.value, limit: 100 } }) }
onMounted(() => {
  if (!admin.isLoggedIn) { navigateTo('/admin/login'); return }
  load()
})
watch(status, load)
async function handle(id: number, action: 'approve' | 'reject') {
  const note = prompt((action === 'approve' ? '批准' : '拒绝') + '的备注（可留空）：') ?? ''
  await api(`/admin/takedowns/${id}/${action}`, { method: 'POST', body: { admin_note: note } })
  await load()
}
async function restore(id: number) {
  if (!confirm('确认恢复该内容的公开展示？')) return
  await api(`/admin/takedowns/${id}/restore`, { method: 'POST' })
  await load()
}
</script>

<template>
  <div class="page">
    <PageHeader title="删除申请" description="处理内容停止公开展示的申请，并可在处理成功后恢复。" eyebrow="Takedowns">
      <template #icon><ShieldAlert :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FSelect v-model="status" :options="statusOptions" size="small" style="width:130px" aria-label="申请状态" />
      </template>
    </PageHeader>

    <div class="card">
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead><tr><th>#</th><th>目标</th><th>申请人</th><th>理由</th><th>状态</th><th>提交</th><th style="text-align:right">操作</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td class="tabular">{{ r.id }}</td>
              <td>
                <a v-if="r.target_url" :href="r.target_url" target="_blank" rel="noopener noreferrer">{{ r.target_type }}/{{ r.target_id }}</a>
                <code v-else class="code-inline">{{ r.target_type }}/{{ r.target_id }}</code>
              </td>
              <td>
                {{ r.requester_name || '-' }}
                <span v-if="r.requester_email" class="muted" style="display:block;font-size:11px">{{ r.requester_email }}</span>
              </td>
              <td style="max-width:360px">{{ r.reason }}</td>
              <td><span class="tag" :class="r.status === 'approved' ? 'tag--success' : r.status === 'rejected' ? 'tag--danger' : 'tag--warn'">{{ r.status }}</span></td>
              <td class="nowrap muted">{{ r.created_at }}</td>
              <td class="actions">
                <FButton v-if="r.status === 'pending'" appearance="primary" size="small" @click="handle(r.id, 'approve')">批准</FButton>
                <FButton v-if="r.status === 'pending'" appearance="subtle" size="small" @click="handle(r.id, 'reject')">拒绝</FButton>
                <FButton v-if="r.status === 'approved' && r.execution_status === 'success'" appearance="outline" size="small" @click="restore(r.id)">恢复</FButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-if="!rows.length" title="暂无删除申请" />
    </div>
  </div>
</template>
