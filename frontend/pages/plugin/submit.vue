<script setup lang="ts">
import { toast } from 'vue-sonner'
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
        // 编辑时读取现有代码不属于真实安装，避免污染插件使用统计。
        const fullCode = await loadFullCode(
          `/plugins/${articleId.value}/download/${detail.current.id}?track_usage=false`,
        )
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
  if (!article.value) {
    errorText.value = '请先确认文章编号'
    return
  }
  if (confirmedArticleId.value !== articleId.value) {
    errorText.value = '文章编号已改变，请重新确认文章'
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
    toast.success('提交成功，申请已进入审核')
    message.value = '提交成功。申请已进入审核，结果会发送到你的注册邮箱。'
  } catch (error: any) {
    toast.error(error?.data?.message || '提交失败')
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
  try { tags.value = await api<PluginTag[]>('/plugins/tags') } catch {}
  if (articleId.value) await inspectArticle()
  loading.value = false
})

useHead({ title: '提交插件 - 洛谷档案馆' })
</script>
<template>
  <div v-if="loading" class="space-y-4">
    <div class="space-y-3 border-b border-border pb-6">
      <Skeleton class="h-8 w-2/5" />
      <Skeleton class="h-4 w-3/5" />
    </div>
    <Skeleton class="h-24 w-full rounded-xl" />
    <Skeleton class="h-72 w-full rounded-xl" />
  </div>

  <div v-else class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          {{ editing ? '提交版本更新' : '发布插件' }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          插件原文始终使用文章的最新归档版本，代码作为独立内容提交审核。
        </p>
      </div>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/plugin/manage">返回我的插件</NuxtLink>
      </Button>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>洛谷文章编号</CardTitle>
        <CardDescription>插件正文取自该文章的最新归档版本。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <Input
            v-model.trim="articleId"
            maxlength="16"
            placeholder="例如 jbekb3o8"
            :disabled="editing || hasPending"
            class="max-w-[16rem] font-mono"
          />
          <Button type="button" variant="outline" @click="inspectArticle">确认文章</Button>
        </div>

        <div
          v-if="article"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
        >
          <span class="min-w-0 text-sm font-medium text-foreground">{{ article.title }}</span>
          <span class="text-xs text-muted-foreground">
            文章 <span class="font-mono">{{ article.article_id }}</span> 已收录
          </span>
        </div>
      </CardContent>
    </Card>

    <Alert
      v-if="errorText"
      variant="destructive"
    >
      <AlertTitle>无法继续</AlertTitle>
      <AlertDescription>{{ errorText }}</AlertDescription>
    </Alert>

    <Alert
      v-if="message"
      :class="submitSucceeded ? 'border-emerald-500/45' : 'border-[var(--lg-yellow)]/55'"
    >
      <AlertTitle>{{ submitSucceeded ? '提交成功' : '提示' }}</AlertTitle>
      <AlertDescription>{{ message }}</AlertDescription>
    </Alert>

    <form v-if="article && !blocked" class="space-y-6" @submit.prevent="submit">
      <PluginSnapshotForm v-model="snapshot" :tags="tags" />

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p class="text-xs text-muted-foreground">提交即表示你确认代码和请求说明真实、完整。</p>
        <Button type="submit" :disabled="submitting || hasPending">
          {{ hasPending ? '已有待审核申请' : submitting ? '提交中…' : '提交审核' }}
        </Button>
      </div>
    </form>
  </div>
</template>
