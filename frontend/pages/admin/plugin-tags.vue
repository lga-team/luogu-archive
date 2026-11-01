<script setup lang="ts">
import { Tags } from 'lucide-vue-next'
import type { PluginTag } from '~/types/plugin'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const rows = ref<PluginTag[]>([])
const newName = ref('')

async function load() { rows.value = await api<any[]>('/admin/plugin-tags') }
async function createTag() {
  if (!newName.value.trim()) return
  await api('/admin/plugin-tags', { method: 'POST', body: { name: newName.value, is_active: true, sort_order: rows.value.length + 1 } })
  newName.value = ''
  await load()
}
async function save(row: PluginTag) {
  await api(`/admin/plugin-tags/${row.id}`, { method: 'PUT', body: { name: row.name, is_active: row.is_active, sort_order: row.sort_order } })
  await load()
}
onMounted(async () => {
  if (!admin.isLoggedIn) return navigateTo('/admin/login')
  await load()
})
</script>

<template>
  <div class="page">
    <PageHeader title="插件标签" description="维护插件广场的功能标签、排序与启用状态。" eyebrow="Plugin tags">
      <template #icon><Tags :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <form class="cluster" @submit.prevent="createTag">
      <FInput v-model.trim="newName" :maxlength="32" placeholder="新标签名称" style="width:240px" aria-label="新标签名称" />
      <FButton type="submit" appearance="primary">新增标签</FButton>
    </form>

    <div class="card">
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead><tr><th>名称</th><th>排序</th><th>启用</th><th style="text-align:right">操作</th></tr></thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td><FInput v-model.trim="row.name" :maxlength="32" size="small" style="width:200px" /></td>
              <td><FInput v-model.number="row.sort_order" type="text" size="small" style="width:90px" /></td>
              <td><FCheckbox v-model="row.is_active" label="启用" /></td>
              <td class="actions"><FButton appearance="outline" size="small" @click="save(row)">保存</FButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-if="!rows.length" title="还没有插件标签" description="在上方输入名称创建第一个标签。" />
    </div>
  </div>
</template>
