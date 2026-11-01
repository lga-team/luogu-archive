<script setup lang="ts">
import { FilePlus2, FolderOpen, SearchCheck } from 'lucide-vue-next'
import type { PluginDetail, PluginSnapshot, PluginTag } from '~/types/plugin'
import { emptyPluginSnapshot } from '~/types/plugin'

const route = useRoute()
const auth = useAuthStore()
const api = useApi()

const articleId = ref(String(route.query.article_id || '').trim())
const confirmedArticleId = ref('')
const tags = ref<PluginTag[]>([])
const snapshot = ref<PluginSnapshot>(emptyPluginSnapshot())
const article = ref<any>(null)
const editing = ref(false)
const hasPending = ref(false)
const blocked = ref(false)
const loading = ref(true)
const submitting = ref(false)
const submitSucceeded = ref(false)
const message = ref('')
const errorText = ref('')

function snapshotFromVersion(detail: PluginDetail, fullCode: string): PluginSnapshot {
  const version = detail.current!
  return {
    summary: detail.summary || '',
    version: '',
    code: fullCode,
    download_filename: version.download_filename,
    user_request_level: version.user_request_level,
    user_request_analysis: version.user_request_analysis,
    tag_ids: detail.tags.map(tag => tag.id),
    runtime_mode: version.runtime_mode,
    supports_desktop: version.supports_desktop,
    supports_mobile: version.supports_mobile,
    last_verified_on: new Date().toISOString().slice(0, 10),
    admin_request_level: null,
    admin_request_analysis: null,
  }
}
async function loadFullCode(path: string): Promise<string> {
  const blob = await api<Blob>(path, { responseType: 'blob' })
  return blob.text()
}

async function inspectArticle() {
  if (!articleId.value) return
  errorText.value = ''
  article.value = null
  if (confirmedArticleId.value !== articleId.value) {
    editing.value = false
    hasPending.value = false
    blocked.value = false
    message.value = ''
    snapshot.value = emptyPluginSnapshot()
  }
  try {
    article.value = await api(`/article/${articleId.value}`)
    confirmedArticleId.value = articleId.value
    try {
      const detail = await api<PluginDetail>(`/plugins/${articleId.value}`)
      if (!detail.is_owner) {
        blocked.value = true
        errorText.value = '该文章已有插件，只有当前上传者可以提交更新。'
        return
      }
      editing.value = !detail.pending_only
      if (detail.pending_application) {
        hasPending.value = true
        const fullCode = await loadFullCode(`/plugins/applications/${detail.pending_application.id}/download`)
        snapshot.value = { ...detail.pending_application.snapshot, code: fullCode }
        message.value = '已载入你的待审核申请，可以查看但不能重复提交。'
      } else if (detail.current) {
        const fullCode = await loadFullCode(`/plugins/${articleId.value}/download/${detail.current.id}?track_usage=false`)
        snapshot.value = snapshotFromVersion(detail, fullCode)
      }
    } catch (error: any) {
      if (error?.statusCode !== 404 && error?.response?.status !== 404) throw error
      editing.value = false
    }
  } catch (error: any) {
    errorText.value = error?.data?.message || '文章不存在或尚未完整收录'
  }
}

async function submit() {
  errorText.value = ''
  message.value = ''
  submitSucceeded.value = false
  if (!auth.isLoggedIn) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  if (!article.value) { errorText.value = '请先确认文章编号'; return }
  if (confirmedArticleId.value !== articleId.value) { errorText.value = '文章编号已改变，请重新确认文章'; return }
  if (hasPending.value) { errorText.value = '已有待审核申请，请先等待审核或在“我的插件”中撤销。'; return }
  if (!snapshot.value.supports_desktop && !snapshot.value.supports_mobile) { errorText.value = '至少选择一种兼容设备'; return }
  submitting.value = true
  try {
    if (editing.value) {
      await api(`/plugins/${articleId.value}/applications/update`, { method: 'POST', body: snapshot.value })
    } else {
      await api('/plugins/applications/publish', { method: 'POST', body: { article_id: articleId.value, snapshot: snapshot.value } })
    }
    hasPending.value = true
    submitSucceeded.value = true
    message.value = '提交成功。申请已进入审核，结果会发送到你的注册邮箱。'
  } catch (error: any) {
    errorText.value = error?.data?.message || '提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.tryRefresh()
  if (!auth.isLoggedIn) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  try { tags.value = await api<PluginTag[]>('/plugins/tags') } catch { /* 无标签时仍可提交 */ }
  if (articleId.value) await inspectArticle()
  loading.value = false
})

useHead({ title: '提交插件 - 洛谷档案馆' })
</script>

<template>
  <LoadingPanel v-if="loading" variant="detail" title="正在准备提交表单" />

  <div v-else class="page page--medium">
    <PageHeader
      :title="editing ? '提交版本更新' : '发布插件'"
      description="插件原文始终使用文章的最新归档版本，代码作为独立内容提交审核。"
      eyebrow="Publish"
    >
      <template #icon><FilePlus2 :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" @click="navigateTo('/plugin/manage')">
          <template #start><FolderOpen :size="16" aria-hidden="true" /></template>我的插件
        </FButton>
      </template>
    </PageHeader>

    <section class="card card__body stack">
      <label for="plugin-article-id" class="field-label">洛谷文章编号</label>
      <div class="input-row" style="flex-wrap: wrap">
        <FInput
          id="plugin-article-id"
          v-model.trim="articleId"
          :maxlength="16"
          placeholder="例如 jbekb3o8"
          :disabled="editing || hasPending"
          class="grow"
          @enter="inspectArticle"
        />
        <FButton appearance="outline" :disabled="!articleId" @click="inspectArticle">
          <template #start><SearchCheck :size="15" aria-hidden="true" /></template>确认文章
        </FButton>
      </div>
      <div v-if="article" class="notice notice--brand">
        <span><strong>{{ article.title }}</strong> · 文章 {{ article.article_id }} 已收录</span>
      </div>
    </section>

    <div v-if="message" class="notice" :class="submitSucceeded ? 'notice--brand' : ''" role="status">{{ message }}</div>
    <div v-if="errorText" class="notice notice--warn" role="alert">{{ errorText }}</div>

    <form v-if="article && !blocked" class="card card__body" @submit.prevent="submit">
      <PluginSnapshotForm v-model="snapshot" :tags="tags" />
      <div class="submit-actions">
        <span class="field-help">提交即表示你确认代码和请求说明真实、完整。</span>
        <FButton type="submit" appearance="primary" :loading="submitting" :disabled="hasPending">
          {{ hasPending ? '已有待审核申请' : submitting ? '提交中…' : '提交审核' }}
        </FButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.submit-actions {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--colorNeutralStroke2);
  flex-wrap: wrap;
}
@media (max-width: 680px) {
  .submit-actions { align-items: stretch; flex-direction: column; }
}
</style>
