<script setup lang="ts">
import { UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const accounts = ref<any[]>([])
const form = ref({ label: '', luogu_uid: 0, uid_value: '', client_id: '', c3vk: '' })
const adding = ref(false)

async function load() { accounts.value = await api<any>('/admin/crawler-accounts') }
onMounted(() => {
  if (!admin.isLoggedIn) { navigateTo('/admin/login'); return }
  load()
})
async function add() {
  if (!form.value.label || !form.value.luogu_uid || !form.value.uid_value || !form.value.client_id) {
    alert('请填写 label / luogu_uid / _uid / __client_id')
    return
  }
  adding.value = true
  try {
    await api('/admin/crawler-accounts', { method: 'POST', body: form.value })
    form.value = { label: '', luogu_uid: 0, uid_value: '', client_id: '', c3vk: '' }
    await load()
  } catch (e: any) {
    alert(e?.data?.message || '失败')
  } finally {
    adding.value = false
  }
}
async function toggle(a: any) {
  const action = a.enabled ? 'disable' : 'enable'
  await api(`/admin/crawler-accounts/${a.id}/${action}`, { method: 'POST' })
  await load()
}
</script>

<template>
  <div class="page">
    <PageHeader title="爬取账号" description="账号仅用于犇犇爬取。cookie 明文传入后加密存库，403/失效会自动禁用。" eyebrow="Crawler accounts">
      <template #icon><UserRound :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <div class="card">
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead>
            <tr><th>ID</th><th>备注</th><th>Luogu UID</th><th>启用</th><th>最近使用</th><th>失败</th><th>状态</th><th style="text-align:right">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in accounts" :key="a.id">
              <td class="tabular">{{ a.id }}</td>
              <td>{{ a.label }}</td>
              <td class="tabular">{{ a.luogu_uid }}</td>
              <td><span class="tag" :class="a.enabled ? 'tag--success' : 'tag--danger'">{{ a.enabled ? '启用' : '禁用' }}</span></td>
              <td class="nowrap muted">{{ a.last_used_at || '-' }}</td>
              <td class="tabular">{{ a.fail_count }}</td>
              <td>
                <code class="code-inline">{{ a.last_status || '-' }}</code>
                <div v-if="a.disabled_reason" class="muted" style="font-size:11px;margin-top:3px">{{ a.disabled_reason }}</div>
              </td>
              <td class="actions">
                <FButton appearance="outline" size="small" @click="toggle(a)">{{ a.enabled ? '禁用' : '启用' }}</FButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-if="!accounts.length" title="还没有爬取账号" description="在下方录入一个账号。" />
    </div>

    <div class="card">
      <div class="card__header"><h2 class="card__title">录入新账号</h2></div>
      <div class="card__body form">
        <div class="form-grid">
          <div class="stack stack--xs"><label class="field-label">备注 (label)</label><FInput v-model="form.label" placeholder="如: 主力1" /></div>
          <div class="stack stack--xs"><label class="field-label">Luogu UID</label><FInput v-model.number="form.luogu_uid" type="text" /></div>
          <div class="stack stack--xs"><label class="field-label">_uid（Cookie）</label><FInput v-model="form.uid_value" /></div>
          <div class="stack stack--xs"><label class="field-label">__client_id（Cookie）</label><FInput v-model="form.client_id" /></div>
          <div class="stack stack--xs span-2"><label class="field-label">C3VK（Cookie，可选）</label><FInput v-model="form.c3vk" /></div>
        </div>
        <div class="form-actions">
          <FButton appearance="primary" :loading="adding" @click="add">{{ adding ? '提交中…' : '添加' }}</FButton>
        </div>
      </div>
    </div>
  </div>
</template>
