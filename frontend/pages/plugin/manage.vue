<script setup lang="ts">
import { FilePenLine, Plus, Sparkles } from 'lucide-vue-next'
import { Button } from '~/components/ui'

const auth = useAuthStore()
const api = useApi()
const loading = ref(true)
const errorText = ref('')
const data = ref<{ plugins: any[]; applications: any[] }>({ plugins: [], applications: [] })

const typeNames: Record<string, string> = {
  publish: '首次发布', update: '版本更新', recommend: '推荐申请', delete: '删除申请',
}
const statusNames: Record<string, string> = {
  pending: '待审核', approved: '已通过', rejected: '已拒绝', cancelled: '已撤销',
}

async function load() {
  loading.value = true
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
    await navigateTo(settingsAuthRoute('login', '/plugin/manage'))
    return
  }
  await load()
})

useHead({ title: '我的插件 - 洛谷档案馆' })
</script>

<template>
  <div class="archive-ui manage-page">
    <ArchivePageHeader title="我的插件" description="查看公开插件、待审核版本和历史申请。" icon="plugin" />

    <section class="archive-card manage-section" aria-labelledby="published-plugins-title">
      <div class="section-heading">
        <h2 id="published-plugins-title">已发布插件</h2>
        <Button as-child class="manage-primary">
          <NuxtLink to="/plugin/submit"><Plus :size="16" aria-hidden="true" />提交新插件</NuxtLink>
        </Button>
      </div>
      <LoadingPanel v-if="loading" title="加载中…" text="" />
      <p v-else-if="errorText" class="section-message error" role="alert">{{ errorText }}</p>
      <div v-else-if="data.plugins.length" class="record-list">
        <article v-for="plugin in data.plugins" :key="plugin.id" class="record-row">
          <div class="record-copy">
            <h3><NuxtLink :to="`/plugin/${plugin.article_id}`">{{ plugin.name }}</NuxtLink></h3>
            <div class="plugin-meta">
              <span class="record-meta">文章 {{ plugin.article_id }}</span>
              <span class="status" :data-status="plugin.is_listed ? 'approved' : 'cancelled'">{{ plugin.is_listed ? '公开展示' : '已下架' }}</span>
            </div>
          </div>
          <div class="row-actions">
            <Button as-child variant="outline" size="sm">
              <NuxtLink :to="`/plugin/submit?article_id=${plugin.article_id}`"><FilePenLine :size="15" aria-hidden="true" />提交更新</NuxtLink>
            </Button>
            <Button v-if="!plugin.is_recommended" variant="outline" size="sm" @click="reasonAction(plugin.article_id, 'recommend')"><Sparkles :size="15" aria-hidden="true" />申请推荐</Button>
            <Button variant="ghost" size="sm" class="danger" @click="reasonAction(plugin.article_id, 'delete')">申请删除</Button>
          </div>
        </article>
      </div>
      <p v-else class="section-message">还没有通过审核的插件</p>
    </section>

    <section v-if="!loading && !errorText" class="archive-card manage-section" aria-labelledby="plugin-applications-title">
      <div class="section-heading">
        <h2 id="plugin-applications-title">申请记录</h2>
      </div>
      <div v-if="data.applications.length" class="record-list">
        <article v-for="application in data.applications" :key="application.id" class="record-row">
          <div class="record-copy">
            <h3>{{ typeNames[application.application_type] || application.application_type }}</h3>
            <p class="record-meta">文章 {{ application.article_id }}<template v-if="application.version"> · v{{ application.version }}</template></p>
          </div>
          <div class="row-actions">
            <span class="status" :data-status="application.status">{{ statusNames[application.status] || application.status }}</span>
            <Button v-if="application.status === 'pending'" variant="outline" size="sm" @click="cancel(application.id)">撤销</Button>
          </div>
          <p v-if="application.review_note" class="review-note"><strong>审核意见：</strong>{{ application.review_note }}</p>
        </article>
      </div>
      <p v-else class="section-message">暂无申请记录</p>
    </section>
  </div>
</template>

<style scoped>
.manage-page { display: grid; gap: 16px; width: min(100%, 1180px); margin: 0 auto; }
.manage-section { --section-pad: 24px; min-width: 0; gap: 0; padding: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; padding: 16px var(--section-pad); min-height: 60px; }
.section-heading h2 { margin: 0; font-size: 18px; }
.archive-ui .manage-primary { background: var(--link); color: #fff; }
.archive-ui .manage-primary:hover { background: color-mix(in srgb, var(--link) 88%, #000); color: #fff; }
.record-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 20px; padding: 14px var(--section-pad); border-top: 1px solid var(--border); }
.record-copy { display: grid; gap: 5px; overflow-wrap: anywhere; }
.record-copy h3 { margin: 0; font-size: 15px; }
.record-meta { margin: 0; color: var(--text-muted); font-size: 13px; }
.plugin-meta, .row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.row-actions .danger { color: var(--lg-red); }
.status { --status-color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--status-color) 36%, var(--border)); border-radius: 6px; background: color-mix(in srgb, var(--status-color) 9%, var(--surface)); color: var(--text); font-size: 12px; white-space: nowrap; }
.status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--status-color); }
.status[data-status="pending"] { --status-color: var(--lg-orange); }
.status[data-status="approved"] { --status-color: var(--lg-green); }
.status[data-status="rejected"] { --status-color: var(--lg-red); }
.review-note { grid-column: 1 / -1; margin: 0; color: var(--text-muted); font-size: 13px; overflow-wrap: anywhere; white-space: pre-wrap; }
.section-message { margin: 0; padding: 24px var(--section-pad); color: var(--text-muted); font-size: 14px; border-top: 1px solid var(--border); overflow-wrap: anywhere; }
.section-message.error { color: var(--lg-red); }
@media (max-width: 720px) {
  .manage-section { --section-pad: 16px; }
  .record-row { grid-template-columns: minmax(0, 1fr); }
}
</style>
