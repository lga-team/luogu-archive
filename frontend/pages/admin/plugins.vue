<script setup lang="ts">
import { Puzzle } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const rows = ref<any[]>([])
const managing = ref<any>(null)
const message = ref('')
const adminAnalysis = computed({
  get: () => managing.value?.admin_request_analysis || '',
  set: (value: string) => { if (managing.value) managing.value.admin_request_analysis = value || null },
})
const adminLevelEnabled = computed({
  get: () => managing.value?.admin_request_level !== null && managing.value?.admin_request_level !== undefined,
  set: (enabled: boolean) => {
    if (!managing.value) return
    managing.value.admin_request_level = enabled ? managing.value.user_request_level : null
  },
})

async function load() { rows.value = await api<any[]>('/admin/plugins') }
function beginManage(row: any) {
  managing.value = structuredClone(toRaw(row))
  message.value = ''
}
async function saveManagement() {
  if (!managing.value) return
  await Promise.all([
    api(`/admin/plugins/${managing.value.id}`, { method: 'PUT', body: { is_official: managing.value.is_official, is_recommended: managing.value.is_recommended } }),
    api(`/admin/plugins/${managing.value.id}/evaluation`, { method: 'PUT', body: { admin_request_level: managing.value.admin_request_level ?? null, admin_request_analysis: managing.value.admin_request_analysis || null } }),
  ])
  const pluginId = managing.value.id
  message.value = '管理状态与请求评估已更新'
  await load()
  const refreshed = rows.value.find(row => row.id === pluginId)
  managing.value = refreshed ? structuredClone(toRaw(refreshed)) : null
}
async function changeListed(row: any) {
  if (row.is_listed) {
    const reason = prompt('请填写下架原因：')
    if (!reason) return
    await api(`/admin/plugins/${row.id}/unlist`, { method: 'POST', body: { reason } })
  } else {
    await api(`/admin/plugins/${row.id}/restore`, { method: 'POST' })
  }
  await load()
  if (managing.value?.id === row.id) managing.value = null
}
onMounted(async () => {
  if (!admin.isLoggedIn) return navigateTo('/admin/login')
  await load()
})
</script>

<template>
  <div class="page">
    <PageHeader title="插件管理" description="管理插件的公开展示状态、官方/推荐徽章与请求评估。" eyebrow="Plugins">
      <template #icon><Puzzle :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>
    <div v-if="message" class="notice notice--brand">{{ message }}</div>

    <div class="workspace">
      <div class="card">
        <div class="table-wrap" style="border:0;border-radius:0">
          <table class="table">
            <thead><tr><th>插件</th><th>状态</th><th>徽章</th><th style="text-align:right">操作</th></tr></thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td><strong>{{ row.name }}</strong><span class="muted" style="display:block;font-size:11px">{{ row.article_id }}</span></td>
                <td><span class="tag" :class="row.is_listed ? 'tag--success' : 'tag--danger'">{{ row.is_listed ? '公开' : '已下架' }}</span></td>
                <td>{{ [row.is_official ? '官方' : '', row.is_recommended ? '推荐' : ''].filter(Boolean).join('、') || '-' }}</td>
                <td class="actions">
                  <FButton appearance="subtle" size="small" @click="beginManage(row)">管理</FButton>
                  <FButton appearance="subtle" size="small" @click="changeListed(row)">{{ row.is_listed ? '下架' : '恢复' }}</FButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-if="!rows.length" title="暂无插件" />
      </div>

      <section v-if="managing" class="card manage-pane">
        <div class="card__header">
          <div><h2 class="card__title">{{ managing.name }}</h2><p class="card__description">文章 {{ managing.article_id }}</p></div>
          <FButton appearance="outline" size="small" :href="'/plugin/' + managing.article_id" target="_blank">查看插件</FButton>
        </div>
        <div class="card__body stack stack--lg">
          <section class="stack">
            <div class="section-head"><h3 class="section-title" style="font-size:15px">用户提交内容</h3><span class="tag">只读</span></div>
            <dl class="manage-dl">
              <div class="wide"><dt>介绍</dt><dd>{{ managing.summary || '-' }}</dd></div>
              <div class="wide"><dt>功能标签</dt><dd>{{ managing.tags.map((tag: any) => tag.name).join('、') || '未选择' }}</dd></div>
            </dl>
          </section>

          <section class="stack">
            <div class="section-head"><h3 class="section-title" style="font-size:15px">用户请求说明</h3><PluginRequestLevelBadge :level="managing.user_request_level" compact /></div>
            <MarkdownBody :source="managing?.user_request_analysis" class="markdown-body" v-if="managing" />
          </section>

          <section class="stack">
            <h3 class="section-title" style="font-size:15px">管理状态</h3>
            <div class="cluster">
              <FCheckbox v-model="managing.is_official" label="官方插件" />
              <FCheckbox v-model="managing.is_recommended" label="推荐插件" />
            </div>
          </section>

          <section class="stack">
            <h3 class="section-title" style="font-size:15px">管理员请求评估</h3>
            <FSwitch v-model="adminLevelEnabled" label="调整公开显示的请求等级" />
            <div v-if="adminLevelEnabled" class="level-editor">
              <div class="cluster" style="justify-content:space-between">
                <span class="muted" style="font-size:12px">管理员显示等级</span>
                <PluginRequestLevelBadge :level="managing.admin_request_level ?? managing.user_request_level" compact />
              </div>
              <FSlider v-model="managing.admin_request_level" :min="0" :max="3" :step="1" aria-label="管理员显示等级" />
            </div>
            <PluginMarkdownEditor v-model="adminAnalysis" label="管理组请求分析" :maxlength="20000" placeholder="管理组人工审核结论（可留空）" />
          </section>

          <div class="cluster" style="justify-content:flex-end">
            <FButton appearance="primary" @click="saveManagement">保存管理信息</FButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.workspace { display: grid; grid-template-columns: minmax(380px, .9fr) minmax(0, 1.1fr); gap: 18px; align-items: start; }
.manage-pane { min-width: 0; }
.manage-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin: 0; font-size: 12px; }
.manage-dl .wide { grid-column: 1 / -1; }
.manage-dl dt { color: var(--colorNeutralForeground3); }
.manage-dl dd { margin: 2px 0 0; overflow-wrap: anywhere; }
.level-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge); }
@media (max-width: 1100px) { .workspace { grid-template-columns: minmax(0, 1fr); } }
</style>
