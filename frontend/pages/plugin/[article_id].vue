<script setup lang="ts">
import { Copy, Download, ExternalLink, History } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { PluginDetail, PluginSnapshot, PluginVersion } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'

const route = useRoute()
const articleId = String(route.params.article_id)
const auth = useAuthStore()
const api = useApi()
const { render } = useMarkdown()
const { format } = useTime()
const { runtimeMode } = usePluginLabels()

const loading = ref(true)
const errorText = ref('')
const detail = ref<PluginDetail | null>(null)
const article = ref<any>(null)
const selectedVersion = ref<PluginVersion | null>(null)
const showPending = ref(false)
const activeTab = ref<string>('article')
const articleRef = ref<HTMLElement | null>(null)
const action = ref<'copy' | 'download'>('copy')
const confirmOpen = ref(false)
const reportOpen = ref(false)
const reportType = ref('dangerous_request')
const reportDescription = ref('')
const claiming = ref(false)
const claimError = ref('')
useCopyCode(articleRef)

const pendingSnapshot = computed(() => detail.value?.pending_application?.snapshot || null)
const displaySnapshot = computed<PluginSnapshot | null>(() => showPending.value ? pendingSnapshot.value : null)
const displayName = computed(() => article.value?.title || detail.value?.name || '插件')
const displayTags = computed(() => showPending.value
  ? detail.value?.pending_application?.tags || []
  : detail.value?.tags || [])
const articleHtml = computed(() => article.value ? render(article.value.content_md) : '')

const displayVersion = computed<PluginVersion | null>(() => {
  if (!displaySnapshot.value) return selectedVersion.value
  const snapshot = displaySnapshot.value
  return {
    id: 0,

    download_count: 0,
    
    version: snapshot.version,
    code: snapshot.code,
    code_bytes: snapshot.code_bytes ?? new TextEncoder().encode(snapshot.code).length,
    code_truncated: snapshot.code_truncated ?? false,
    code_sha256: '审核通过后由后端计算',
    download_filename: snapshot.download_filename,
    user_request_level: snapshot.user_request_level,
    user_request_analysis: snapshot.user_request_analysis,
    admin_request_level: null,
    admin_request_analysis: null,
    final_request_level: snapshot.user_request_level,
    runtime_mode: snapshot.runtime_mode,
    supports_desktop: snapshot.supports_desktop,
    supports_mobile: snapshot.supports_mobile,
    last_verified_on: snapshot.last_verified_on,
    published_at: '',
  }
})

const codePreview = computed(() => ({
  code: displayVersion.value?.code || '',
  truncated: displayVersion.value?.code_truncated ?? false,
}))
const copyDisabled = computed(() => (displayVersion.value?.code_bytes ?? 0) > PLUGIN_CODE_COPY_MAX_BYTES)

const userAnalysisHtml = computed(() => render(displayVersion.value?.user_request_analysis || ''))
const adminAnalysisHtml = computed(() => render(displayVersion.value?.admin_request_analysis || ''))

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const [pluginData, articleData] = await Promise.all([
      api<PluginDetail>(`/plugins/${articleId}`),
      api<any>(`/article/${articleId}`),
    ])
    detail.value = pluginData
    article.value = articleData
    selectedVersion.value = pluginData.current
    showPending.value = Boolean(pluginData.pending_application)
  } catch (error: any) {
    errorText.value = error?.data?.message || '插件不存在或尚未通过审核'
  } finally {
    loading.value = false
  }
}

async function selectVersion(versionId: string) {
  if (!versionId || !detail.value) return
  selectedVersion.value = await api<PluginVersion>(`/plugins/${articleId}/versions/${versionId}`)
  showPending.value = false
}

function openInstall(nextAction: 'copy' | 'download') {
  if (showPending.value) {
    toast.value = '待审核代码仅供上传者预览，审核通过后才能复制或下载。'
    return
  }
  if (nextAction === 'copy' && copyDisabled.value) {
    showToast('完整代码超过 100 KiB，请下载文件')
    return
  }
  action.value = nextAction
  confirmOpen.value = true
}

function showToast(message: string) {
  toast.success(message)
}

async function submitReport() {
  if (!auth.isLoggedIn) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  try {
    await api(`/plugins/${articleId}/reports`, {
      method: 'POST',
      body: { report_type: reportType.value, description: reportDescription.value },
    })
    reportOpen.value = false
    reportDescription.value = ''
    showToast('举报已提交')
  } catch (error: any) {
    toast.error(error?.data?.message || '举报提交失败')
  }
}

async function claimPlugin() {
  if (claiming.value) return
  claiming.value = true
  claimError.value = ''
  try {
    await api(`/plugins/${articleId}/claim`, { method: 'POST' })
    await load()
    showToast('认领成功，插件已转入你的账号')
  } catch (error: any) {
    claimError.value = error?.data?.message || '认领失败，请稍后重试'
  } finally {
    claiming.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.tryRefresh()
  await load()
})

useHead(() => ({ title: `${displayName.value} - 插件广场` }))
</script>
<template>
  <div v-if="loading" class="space-y-4">
    <div class="space-y-3 border-b border-border pb-5">
      <Skeleton class="h-8 w-3/5" />
      <Skeleton class="h-4 w-2/5" />
      <Skeleton class="h-3 w-1/3" />
    </div>
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-72 w-full rounded-xl" />
  </div>

  <Card v-else-if="errorText" class="mx-auto max-w-md gap-0 py-12 text-center">
    <p class="text-sm text-destructive">{{ errorText }}</p>
  </Card>

  <div v-else-if="detail && article" class="space-y-4">
    <header class="border-b border-border pb-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold leading-snug tracking-tight text-foreground">
            {{ displayName }}
          </h1>

          <div
            v-if="article.author"
            class="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <UserAvatar :user="article.author" size="md" />
              <LuoguUserName :user="article.author" show-badge truncate class="max-w-[12rem]" />
            </span>
            <span aria-hidden="true" class="text-border">·</span>
            <span>{{ displayVersion ? runtimeMode(displayVersion.runtime_mode) : '未知运行方式' }}</span>
            <span aria-hidden="true" class="text-border">·</span>
            <span>{{ detail.updated_at ? `更新于 ${format(detail.updated_at)}` : '更新时间未知' }}</span>
            <template v-if="detail.total_usage !== undefined">
              <span aria-hidden="true" class="text-border">·</span>
              <span class="tabular-nums">使用 {{ detail.total_usage }} 次</span>
            </template>
          </div>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <Badge
              v-if="detail.is_official"
              class="h-5 border-transparent bg-[var(--lg-blue)]/12 px-1.5 font-normal text-[var(--lg-blue)]"
            >
              官方插件
            </Badge>
            <Badge
              v-if="detail.is_recommended"
              class="h-5 border-transparent bg-[var(--warning)]/20 px-1.5 font-normal text-[#8a6d00] dark:text-[var(--warning)]"
            >
              推荐插件
            </Badge>
            <Badge
              v-for="tag in displayTags"
              :key="tag.id"
              variant="outline"
              class="h-5 px-1.5 font-normal"
            >
              {{ tag.name }}
            </Badge>
          </div>
        </div>

        <PluginRequestLevelBadge v-if="displayVersion" :level="displayVersion.final_request_level" />
      </div>
    </header>

    <Alert v-if="detail.can_claim" class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <AlertTitle>此插件可能为你所有</AlertTitle>
        <AlertDescription>原文章作者与你绑定的洛谷账号一致，认领后可管理和更新此插件。</AlertDescription>
        <p v-if="claimError" class="mt-1 text-xs text-destructive">{{ claimError }}</p>
      </div>
      <Button size="sm" :disabled="claiming" @click="claimPlugin">
        {{ claiming ? '认领中…' : '认领' }}
      </Button>
    </Alert>

    <Alert v-if="detail.pending_application" class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <AlertTitle>当前显示的是待审核版本 v{{ detail.pending_application.snapshot.version }}</AlertTitle>
        <AlertDescription>此版本仅你和管理员可见，公开页面仍展示上一个已审核版本。</AlertDescription>
      </div>
      <Button
        v-if="detail.current"
        variant="outline"
        size="sm"
        class="shrink-0"
        @click="showPending = !showPending; selectedVersion = detail.current"
      >
        {{ showPending ? '切到已审核代码' : '查看待审核代码' }}
      </Button>
    </Alert>

    <Alert v-if="!detail.is_listed" variant="destructive">
      <AlertTitle>插件已下架</AlertTitle>
      <AlertDescription>{{ detail.down_reason || '该插件暂不在广场公开展示。' }}</AlertDescription>
    </Alert>

    <Tabs v-model="activeTab" class="gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="article">原文</TabsTrigger>
          <TabsTrigger value="code">代码</TabsTrigger>
          <TabsTrigger value="analysis">请求分析</TabsTrigger>
        </TabsList>

        <div class="flex items-center gap-3 text-sm">
          <NuxtLink
            v-if="article.version_count > 1"
            :to="`/article/${articleId}/history`"
            class="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <History class="size-3.5" />
            历史版本
          </NuxtLink>
          <a
            :href="`https://www.luogu.com.cn/article/${articleId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink class="size-3.5" />
            洛谷原文
          </a>
        </div>
      </div>

      <TabsContent value="article" class="mt-0">
        <ArticleAdminNote :note="article.admin_note" />
        <article ref="articleRef" class="lg-content mt-4" v-html="articleHtml" />
      </TabsContent>

      <TabsContent value="code" class="mt-0">
        <div v-if="displayVersion" class="space-y-4">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">代码版本</Label>
              <Select
                :model-value="showPending ? 'pending' : String(displayVersion.id)"
                @update:model-value="selectVersion"
              >
                <SelectTrigger size="sm" class="w-[16rem] max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-if="showPending" value="pending">
                    v{{ displayVersion.version }} · 待审核
                  </SelectItem>
                  <SelectItem
                    v-for="version in detail.versions"
                    :key="version.id"
                    :value="String(version.id)"
                  >
                    v{{ version.version }}{{ version.is_current ? ' · 当前正式版' : '' }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="displayVersion.published_at" class="text-xs text-muted-foreground">
                发布于 {{ format(displayVersion.published_at) }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="copyDisabled"
                :title="copyDisabled ? '完整代码超过 100 KiB，仅支持下载' : '复制代码'"
                @click="openInstall('copy')"
              >
                <Copy class="size-3.5" />
                复制代码
              </Button>
              <Button size="sm" title="下载代码" @click="openInstall('download')">
                <Download class="size-3.5" />
                下载文件
              </Button>
            </div>
          </div>

          <Alert v-if="codePreview.truncated">
            <AlertTitle>代码较长，已截断显示</AlertTitle>
            <AlertDescription>页面最多展示前 1000 行且不超过 50 KiB，完整代码未被修改。</AlertDescription>
          </Alert>

          <Alert v-if="copyDisabled" variant="destructive">
            <AlertTitle>复制已禁用</AlertTitle>
            <AlertDescription>完整代码超过 100 KiB，请下载文件。</AlertDescription>
          </Alert>

          <pre class="max-h-[620px] overflow-auto rounded-lg border border-border bg-muted/50 p-4 text-[13px] leading-relaxed"><code>{{ codePreview.code }}</code></pre>

          <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            <div class="bg-card px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">运行方式</dt>
              <dd class="mt-0.5 text-sm text-foreground">{{ runtimeMode(displayVersion.runtime_mode) }}</dd>
            </div>
            <div class="bg-card px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">兼容设备</dt>
              <dd class="mt-0.5 text-sm text-foreground">
                {{ [displayVersion.supports_desktop ? '桌面端' : '', displayVersion.supports_mobile ? '移动端' : ''].filter(Boolean).join('、') || '—' }}
              </dd>
            </div>
            <div class="bg-card px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">下载次数</dt>
              <dd class="mt-0.5 text-sm tabular-nums text-foreground">{{ displayVersion.download_count ?? 0 }}</dd>
            </div>
            <div class="bg-card px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">最后验证</dt>
              <dd class="mt-0.5 text-sm text-foreground">{{ displayVersion.last_verified_on || '—' }}</dd>
            </div>
            <div class="col-span-2 bg-card px-3 py-2.5 sm:col-span-4">
              <dt class="text-xs text-muted-foreground">SHA-256</dt>
              <dd class="mt-0.5 break-all font-mono text-xs text-foreground">{{ displayVersion.code_sha256 }}</dd>
            </div>
          </dl>
        </div>
      </TabsContent>

      <TabsContent value="analysis" class="mt-0">
        <div v-if="displayVersion" class="space-y-6">
          <div
            class="grid gap-px overflow-hidden rounded-lg border border-border bg-border"
            :class="displayVersion.admin_request_level !== null ? 'sm:grid-cols-2' : ''"
          >
            <div class="flex flex-col items-start gap-2 bg-card px-4 py-3">
              <span class="text-xs text-muted-foreground">用户提交等级</span>
              <PluginRequestLevelBadge :level="displayVersion.user_request_level" />
            </div>
            <div v-if="displayVersion.admin_request_level !== null" class="flex flex-col items-start gap-2 bg-card px-4 py-3">
              <span class="text-xs text-muted-foreground">管理员更改等级</span>
              <PluginRequestLevelBadge :level="displayVersion.admin_request_level" />
            </div>
          </div>

          <section>
            <h2 class="text-base font-semibold text-foreground">上传者请求分析</h2>
            <div class="lg-content mt-3" v-html="userAnalysisHtml" />
          </section>

          <section v-if="displayVersion.admin_request_analysis" class="border-t border-border pt-5">
            <h2 class="text-base font-semibold text-foreground">管理组请求分析</h2>
            <div class="lg-content mt-3" v-html="adminAnalysisHtml" />
          </section>
        </div>
      </TabsContent>
    </Tabs>

    <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
      <span class="tabular-nums">文章编号 {{ articleId }}</span>
      <div class="flex items-center gap-2">
        <Button v-if="detail.is_owner" variant="outline" size="sm" as-child>
          <NuxtLink :to="`/plugin/submit?article_id=${articleId}`">提交更新</NuxtLink>
        </Button>
        <Button variant="ghost" size="sm" @click="reportOpen = true">举报插件</Button>
      </div>
    </footer>

    <Dialog v-model:open="reportOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>举报插件</DialogTitle>
          <DialogDescription>请选择问题类型并补充说明，管理组会尽快处理。</DialogDescription>
        </DialogHeader>

        <form class="space-y-3" @submit.prevent="submitReport">
          <Select v-model="reportType">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择问题类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dangerous_request">危险请求</SelectItem>
              <SelectItem value="malicious_code">恶意代码</SelectItem>
              <SelectItem value="broken">失效</SelectItem>
              <SelectItem value="copyright">侵权</SelectItem>
              <SelectItem value="misleading">信息不实</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            v-model.trim="reportDescription"
            rows="5"
            minlength="10"
            maxlength="5000"
            required
            placeholder="请至少填写 10 个字的具体说明"
          />

          <DialogFooter>
            <Button type="button" variant="outline" @click="reportOpen = false">取消</Button>
            <Button type="submit">提交举报</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <PluginInstallConfirm
      v-if="displayVersion"
      :open="confirmOpen"
      :article-id="articleId"
      :plugin-name="displayName"
      :version="displayVersion"
      :action="action"
      :public-download="detail.is_listed"
      @close="confirmOpen = false"
      @done="showToast"
      @analysis="activeTab = 'analysis'; confirmOpen = false"
    />
  </div>
</template>
