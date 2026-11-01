<script setup lang="ts">
import { FolderOpen, Plus, RefreshCw } from 'lucide-vue-next'

const auth = useAuthStore()
const api = useApi()
const loading = ref(true)
const errorText = ref('')
const data = ref<{ plugins: any[]; applications: any[] }>({ plugins: [], applications: [] })

const typeNames: Record<string, string> = { publish: '首次发布', update: '版本更新', recommend: '推荐申请', delete: '删除申请' }
const statusNames: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', cancelled: '已撤销' }
const statusClass = (status: string) => status === 'approved' ? 'tag--success' : status === 'rejected' ? 'tag--danger' : status === 'pending' ? 'tag--warn' : 'tag'

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    data.value = await api('/plugins/manage')
  } catch (error: any) {
    errorText.value = error?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}
async function cancel(applicationId: number) {
  if (!confirm('确定撤销这条待审核申请吗？')) return
  await api(`/plugins/applications/${applicationId}`, { method: 'DELETE' })
  await load()
}
async function reasonAction(articleId: string, type: 'recommend' | 'delete') {
  const reason = prompt(type === 'recommend' ? '请填写推荐理由：' : '请填写删除原因：')
  if (!reason) return
  try {
    await api(`/plugins/${articleId}/applications/${type}`, { method: 'POST', body: { reason } })
    await load()
  } catch (error: any) {
    alert(error?.data?.message || '提交失败')
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.tryRefresh()
  if (!auth.isLoggedIn) {
    await navigateTo('/login?redirect=/plugin/manage')
    return
  }
  await load()
})

useHead({ title: '我的插件 - 洛谷档案馆' })
</script>

<template>
  <div class="page page--medium">
    <PageHeader title="我的插件" description="查看公开插件、待审核版本和历史申请。" eyebrow="My plugins">
      <template #icon><FolderOpen :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="subtle" icon-only :disabled="loading" aria-label="刷新" title="刷新" @click="load">
          <RefreshCw :size="15" aria-hidden="true" />
        </FButton>
        <FButton appearance="primary" @click="navigateTo('/plugin/submit')">
          <template #start><Plus :size="15" aria-hidden="true" /></template>提交新插件
        </FButton>
      </template>
    </PageHeader>

    <LoadingPanel v-if="loading" variant="list" :rows="4" title="正在加载我的插件" />
    <div v-else-if="errorText" class="notice notice--warn" role="alert">{{ errorText }}</div>

    <template v-else>
      <section class="page-section">
        <div class="section-head">
          <div class="section-head__text">
            <h2 class="section-title">已发布插件</h2>
            <span class="section-subtitle">{{ data.plugins.length }} 个公开插件</span>
          </div>
        </div>
        <div v-if="data.plugins.length" class="plugin-manage-list">
          <article v-for="plugin in data.plugins" :key="plugin.id" class="card plugin-manage-row">
            <div class="plugin-manage-main">
              <NuxtLink :to="`/plugin/${plugin.article_id}`" class="plugin-manage-name">{{ plugin.name }}</NuxtLink>
              <p class="muted" style="font-size: 12px">
                文章 {{ plugin.article_id }} ·
                <span :class="plugin.is_listed ? 'success-text' : 'warning-text'">{{ plugin.is_listed ? '公开展示' : '已下架' }}</span>
              </p>
            </div>
            <div class="cluster">
              <FButton appearance="outline" size="small" @click="navigateTo(`/plugin/submit?article_id=${plugin.article_id}`)">提交更新</FButton>
              <FButton v-if="!plugin.is_recommended" appearance="subtle" size="small" @click="reasonAction(plugin.article_id, 'recommend')">申请推荐</FButton>
              <FButton appearance="subtle" size="small" @click="reasonAction(plugin.article_id, 'delete')">申请删除</FButton>
            </div>
          </article>
        </div>
        <EmptyState v-else title="还没有通过审核的插件" description="提交插件并通过审核后会出现在这里。">
          <template #actions><FButton appearance="primary" @click="navigateTo('/plugin/submit')">提交插件</FButton></template>
        </EmptyState>
      </section>

      <section class="page-section">
        <div class="section-head">
          <div class="section-head__text">
            <h2 class="section-title">申请记录</h2>
            <span class="section-subtitle">{{ data.applications.length }} 条记录</span>
          </div>
        </div>
        <div v-if="data.applications.length" class="card list">
          <article v-for="application in data.applications" :key="application.id" class="application-row">
            <div class="stack stack--xs" style="min-width:0">
              <div class="cluster">
                <strong>{{ typeNames[application.application_type] || application.application_type }}</strong>
                <span class="tag" :class="statusClass(application.status)">{{ statusNames[application.status] || application.status }}</span>
              </div>
              <span class="muted" style="font-size: 12px">
                文章 {{ application.article_id }}<template v-if="application.version"> · v{{ application.version }}</template>
              </span>
              <p v-if="application.review_note" class="field-error" style="margin-top:4px">审核意见：{{ application.review_note }}</p>
            </div>
            <FButton v-if="application.status === 'pending'" appearance="outline" size="small" @click="cancel(application.id)">撤销</FButton>
          </article>
        </div>
        <EmptyState v-else title="暂无申请记录" description="提交插件或版本更新后会在这里看到审核进度。" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.plugin-manage-list { display: flex; flex-direction: column; gap: 8px; }
.plugin-manage-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; flex-wrap: wrap; }
.plugin-manage-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.plugin-manage-name { font-weight: 600; font-size: 15px; color: var(--colorNeutralForeground1); text-decoration: none; }
.plugin-manage-name:hover { color: var(--colorBrandForeground1); }
.application-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--colorNeutralStroke2); flex-wrap: wrap; }
.application-row:last-child { border-bottom: 0; }
</style>
