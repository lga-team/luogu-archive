<script setup lang="ts">
import { Check, Send } from 'lucide-vue-next'
import { Button, Input } from '~/components/ui'
import type { PluginDetail, PluginSnapshot, PluginTag } from '~/types/plugin'
import { emptyPluginSnapshot } from '~/types/plugin'
import { parseArchiveAddress } from '~/utils/parseArchiveAddress'

const route = useRoute()
const auth = useAuthStore()
const api = useApi()

const articleInput = ref(String(route.query.article_id || '').trim())
const articleId = computed(() => {
  const input = articleInput.value.trim()
  if (/^[A-Za-z0-9]{1,16}$/.test(input)) return input
  try {
    return parseArchiveAddress(input).match(/^\/article\/([A-Za-z0-9]{1,16})$/)?.[1] ?? ''
  } catch {
    return ''
  }
})
const confirmedArticleId = ref('')
const tags = ref<PluginTag[]>([])
const snapshot = ref<PluginSnapshot>(emptyPluginSnapshot())
const article = ref<any>(null)
const editing = ref(false)
const hasPending = ref(false)
const blocked = ref(false)
const loading = ref(true)
const inspecting = ref(false)
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
  if (inspecting.value || submitting.value || !articleInput.value.trim()) return
  const id = articleId.value
  if (!id) {
    errorText.value = '请输入有效的洛谷文章编号或文章链接。'
    return
  }
  inspecting.value = true
  errorText.value = ''
  article.value = null
  if (confirmedArticleId.value !== id) {
    editing.value = false
    hasPending.value = false
    blocked.value = false
    message.value = ''
    snapshot.value = emptyPluginSnapshot()
  }
  try {
    article.value = await api(`/article/${id}`)
    confirmedArticleId.value = id
    try {
      const detail = await api<PluginDetail>(`/plugins/${id}`)
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
        // 编辑时读取现有代码不属于真实安装，避免污染插件使用统计。
        const fullCode = await loadFullCode(
          `/plugins/${id}/download/${detail.current.id}?track_usage=false`,
        )
        snapshot.value = snapshotFromVersion(detail, fullCode)
      }
    } catch (error: any) {
      if (error?.statusCode !== 404 && error?.response?.status !== 404) throw error
      editing.value = false
    }
  } catch (error: any) {
    errorText.value = error?.data?.message || '文章不存在或尚未完整收录'
  } finally {
    inspecting.value = false
  }
}

async function submit() {
  errorText.value = ''
  message.value = ''
  submitSucceeded.value = false
  if (!auth.isLoggedIn) {
    await navigateTo(settingsAuthRoute('login', route.fullPath))
    return
  }
  if (!article.value) {
    errorText.value = '请先确认文章'
    return
  }
  if (confirmedArticleId.value !== articleId.value) {
    errorText.value = '文章已改变，请重新确认'
    return
  }
  if (hasPending.value) {
    errorText.value = '已有待审核申请，请先等待审核或在“我的插件”中撤销。'
    return
  }
  if (!snapshot.value.supports_desktop && !snapshot.value.supports_mobile) {
    errorText.value = '至少选择一种兼容设备'
    return
  }
  submitting.value = true
  try {
    if (editing.value) {
      await api(`/plugins/${articleId.value}/applications/update`, {
        method: 'POST',
        body: snapshot.value,
      })
    } else {
      await api('/plugins/applications/publish', {
        method: 'POST',
        body: { article_id: articleId.value, snapshot: snapshot.value },
      })
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
    await navigateTo(settingsAuthRoute('login', route.fullPath))
    return
  }
  try { tags.value = await api<PluginTag[]>('/plugins/tags') } catch {}
  if (articleInput.value) await inspectArticle()
  loading.value = false
})

useHead({ title: '提交插件 - 洛谷档案馆' })
</script>

<template>
  <div class="archive-ui submit-page">
    <ArchivePageHeader
      :title="editing ? '提交版本更新' : '发布插件'"
      description="插件原文始终使用文章的最新归档版本，代码作为独立内容提交审核。"
      icon="plugin"
    />
    <LoadingPanel v-if="loading" title="加载中…" text="" />
    <template v-else>
      <form class="archive-card article-picker" aria-label="插件原文" :aria-busy="inspecting" @submit.prevent="inspectArticle">
        <div class="article-picker-row">
          <Input
            v-model="articleInput"
            aria-label="洛谷文章编号或链接"
            placeholder="洛谷文章编号或链接"
            :disabled="editing || hasPending || inspecting || submitting"
          />
          <Button type="submit" variant="outline" :disabled="!articleInput.trim() || inspecting || submitting">
            <Check :size="16" aria-hidden="true" />{{ inspecting ? '确认中…' : '确认文章' }}
          </Button>
        </div>
        <div v-if="article" class="article-result">
          <strong>{{ article.title }}</strong>
          <span>文章 {{ article.article_id }} 已收录</span>
        </div>
      </form>

      <p v-if="message" class="message ok" :class="{ submitted: submitSucceeded }" role="status">{{ message }}</p>
      <p v-if="errorText" class="message error" role="alert">{{ errorText }}</p>

      <form v-if="article && !blocked && !inspecting" class="archive-card plugin-form" @submit.prevent="submit">
        <PluginSnapshotForm v-model="snapshot" :tags="tags" />
        <div class="submit-actions">
          <span>提交即表示你确认代码和请求说明真实、完整。</span>
          <Button type="submit" class="submit-primary" :disabled="submitting || hasPending">
            <Send :size="16" aria-hidden="true" />
            {{ hasPending ? '已有待审核申请' : submitting ? '提交中…' : '提交审核' }}
          </Button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.submit-page { display: grid; gap: 16px; width: min(100%, 1180px); margin: 0 auto; }
.article-picker, .plugin-form { min-width: 0; padding: 24px; }
.article-picker { gap: 16px; }
.article-picker-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.submit-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; }
.article-result { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; font-size: 13px; color: var(--text-muted); }
.article-result strong { font-size: 14px; color: var(--text); overflow-wrap: anywhere; }
.message { margin: 0; padding: 10px 13px; border: 1px solid var(--border); border-inline-start: 3px solid; border-radius: 6px; background: var(--surface); overflow-wrap: anywhere; }
.message.ok { border-color: var(--lg-green); }
.message.submitted { position: fixed; z-index: 850; left: 50%; bottom: 28px; width: min(560px, calc(100vw - 32px)); box-sizing: border-box; transform: translateX(-50%); border: 1px solid var(--lg-green); border-left-width: 5px; border-radius: 7px; background: var(--surface); color: var(--text); font-size: 15px; font-weight: 600; box-shadow: 0 12px 36px rgba(0, 0, 0, .22); }
.message.error { border-color: var(--lg-red); color: var(--lg-red); }
.submit-actions { padding-top: 20px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
.submit-actions .submit-primary { margin-inline-start: auto; }
.archive-ui .submit-primary { background: var(--link); color: #fff; }
.archive-ui .submit-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--link) 88%, #000); color: #fff; }
@media (max-width: 640px) {
  .article-picker, .plugin-form { padding: 16px; }
}
</style>
