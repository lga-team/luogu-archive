<script setup lang="ts">
import { ChevronDown, Clock3, Code2, Copy, Download, ExternalLink, FileText, Flag, Info, LoaderCircle, MoreHorizontal, Pencil, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem } from 'reka-ui'
import { Button, Dialog, Select, Tabs, TabsList, TabsTrigger, TabsContent, Textarea } from '~/components/ui'
import type { PluginDetail, PluginSnapshot, PluginVersion } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'

const route = useRoute()
definePageMeta({ key: route => route.path })
const articleId = String(route.params.article_id)
const auth = useAuthStore()
const api = useApi()
const { render } = useMarkdown()
const { format, smart } = useTime()
const { runtimeMode } = usePluginLabels()

const loading = ref(true)
const errorText = ref('')
const detail = ref<PluginDetail | null>(null)
const article = ref<any>(null)
const selectedVersion = ref<PluginVersion | null>(null)
const showPending = ref(false)
const activeTab = ref('article')
const articleRef = shallowRef<HTMLElement | null>(null)
const action = ref<'copy' | 'download'>('copy')
const confirmOpen = ref(false)
const toast = ref('')
const reportOpen = ref(false)
const reportType = ref('dangerous_request')
const reportDescription = ref('')
const claiming = ref(false)
const claimError = ref('')
const reportError = ref('')
const reporting = ref(false)
const versionLoading = ref(false)
const versionError = ref('')
const infoOpen = ref(true)
let versionRequest = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let infoMedia: MediaQueryList | undefined
function updateInfoLayout() { infoOpen.value = !infoMedia?.matches }
useCopyCode(articleRef)

const pendingSnapshot = computed(() => detail.value?.pending_application?.snapshot || null)
const displaySnapshot = computed<PluginSnapshot | null>(() => showPending.value ? pendingSnapshot.value : null)
const displayName = computed(() => article.value?.title || detail.value?.name || '插件详情')
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
const actionsDisabled = computed(() => !displayVersion.value || showPending.value || versionLoading.value || loading.value)
const selectedVersionKey = computed(() => showPending.value ? 'pending' : String(selectedVersion.value?.id || ''))
const versionOptions = computed(() => [
  ...(detail.value?.pending_application ? [{ value: 'pending', label: `v${detail.value.pending_application.snapshot.version} · 待审核` }] : []),
  ...(detail.value?.versions || []).map(version => ({ value: String(version.id), label: `v${version.version}${version.is_current ? ' · 最新正式版' : ''}` })),
])
const compatibility = computed(() => [displayVersion.value?.supports_desktop ? '桌面端' : '', displayVersion.value?.supports_mobile ? '移动端' : ''].filter(Boolean).join('、') || '未注明')
const reportOptions = [
  { value: 'dangerous_request', label: '危险请求' }, { value: 'malicious_code', label: '恶意代码' },
  { value: 'broken', label: '失效' }, { value: 'copyright', label: '侵权' },
  { value: 'misleading', label: '信息不实' }, { value: 'other', label: '其他' },
]
function codeSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

const userAnalysisHtml = computed(() => render(displayVersion.value?.user_request_analysis || ''))
const adminAnalysisHtml = computed(() => render(displayVersion.value?.admin_request_analysis || ''))

async function load() {
  loading.value = true
  errorText.value = ''
  versionRequest++
  versionLoading.value = false
  versionError.value = ''
  confirmOpen.value = false
  try {
    const [pluginData, articleData] = await Promise.all([
      api<PluginDetail>(`/plugins/${articleId}`),
      api<any>(`/article/${articleId}`),
    ])
    if (disposed) return
    detail.value = pluginData
    article.value = articleData
    selectedVersion.value = pluginData.current
    showPending.value = Boolean(pluginData.pending_application)
  } catch (error: any) {
    if (!disposed) errorText.value = error?.data?.message || '插件不存在、尚未通过审核或暂时无法读取。'
  } finally {
    if (!disposed) loading.value = false
  }
}

async function selectVersion(versionId: string) {
  if (!versionId || !detail.value || versionLoading.value || versionId === selectedVersionKey.value) return
  confirmOpen.value = false
  versionError.value = ''
  if (versionId === 'pending') {
    if (pendingSnapshot.value) showPending.value = true
    return
  }
  if (!detail.value.versions.some(version => String(version.id) === versionId)) return
  const request = ++versionRequest
  versionLoading.value = true
  try {
    const version = versionId === String(detail.value.current?.id)
      ? detail.value.current
      : await api<PluginVersion>(`/plugins/${articleId}/versions/${versionId}`)
    if (disposed || request !== versionRequest) return
    selectedVersion.value = version
    showPending.value = false
  } catch (error: any) {
    if (!disposed && request === versionRequest) versionError.value = error?.data?.message || '版本读取失败，仍保留原来的内容，请重新选择。'
  } finally {
    if (!disposed && request === versionRequest) versionLoading.value = false
  }
}

function openInstall(nextAction: 'copy' | 'download') {
  if (actionsDisabled.value) return
  if (nextAction === 'copy' && copyDisabled.value) {
    showToast('完整代码超过 100 KiB，请下载文件')
    return
  }
  action.value = nextAction
  confirmOpen.value = true
}

function showToast(message: string) {
  clearTimeout(toastTimer)
  toast.value = message
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}

async function openReport() {
  if (!auth.isLoggedIn) {
    await navigateTo(settingsAuthRoute('login', route.fullPath))
    return
  }
  reportError.value = ''
  reportOpen.value = true
}

async function submitReport() {
  if (reporting.value) return
  if (!auth.isLoggedIn) { await openReport(); return }
  if (reportDescription.value.trim().length < 10) {
    reportError.value = '请至少填写 10 个字的具体说明。'
    return
  }
  reporting.value = true
  reportError.value = ''
  try {
    await api(`/plugins/${articleId}/reports`, {
      method: 'POST',
      body: { report_type: reportType.value, description: reportDescription.value.trim() },
    })
    reportOpen.value = false
    reportDescription.value = ''
    showToast('举报已提交')
  } catch (error: any) {
    reportError.value = error?.data?.message || '举报提交失败，请重试。'
  } finally { reporting.value = false }
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
  infoMedia = window.matchMedia('(max-width: 760px)')
  updateInfoLayout()
  infoMedia.addEventListener('change', updateInfoLayout)
  if (!auth.initialized) await auth.tryRefresh()
  if (!disposed) await load()
})
onBeforeUnmount(() => { disposed = true; versionRequest++; clearTimeout(toastTimer); infoMedia?.removeEventListener('change', updateInfoLayout) })

useHead(() => ({ title: `${displayName.value} - 插件广场` }))
</script>

<template>
  <div class="archive-ui plugin-page">
    <div class="plugin-layout">
      <header class="plugin-heading">
        <section class="archive-card plugin-title-block">
          <h1>{{ displayName }}</h1>
          <div class="plugin-meta">
            <div class="plugin-author">
              <NuxtLink v-if="article?.author" :to="'/user/' + article.author.uid" :aria-label="article.author.name + ' 的主页'">
                <img v-if="article.author.avatar" :src="article.author.avatar" alt="" class="plugin-avatar" loading="lazy">
                <span v-else class="plugin-avatar plugin-avatar-fallback">{{ (article.author.name || '?').charAt(0).toUpperCase() }}</span>
              </NuxtLink>
              <div class="plugin-author-name"><span class="plugin-label">作者</span><LuoguUserName v-if="article?.author" :user="article.author" show-badge /><span v-else>{{ loading ? '正在读取' : '作者未收录' }}</span></div>
            </div>
            <div class="plugin-published"><span class="plugin-label">最新版本</span><time v-if="detail?.current?.published_at" :datetime="detail.current.published_at">{{ format(detail.current.published_at, 'YYYY-MM-DD HH:mm:ss') }}</time><span v-else>—</span></div>
          </div>
          <PluginBadges class="plugin-tags" :is-official="detail?.is_official" :is-recommended="detail?.is_recommended" :tags="displayTags" />
        </section>
        <div class="archive-card plugin-toolbar">
          <span class="plugin-updated">上次更新：<time v-if="detail?.updated_at" :datetime="detail.updated_at" :title="format(detail.updated_at, 'YYYY-MM-DD HH:mm:ss')">{{ smart(detail.updated_at) }}</time><span v-else>—</span></span>
          <div class="plugin-actions">
            <Button size="sm" class="plugin-primary" :disabled="actionsDisabled" @click="openInstall('download')"><Download :size="14" aria-hidden="true" />下载文件</Button>
            <Button size="sm" variant="outline" :disabled="actionsDisabled || copyDisabled" :title="copyDisabled ? '完整代码超过 100 KiB，仅支持下载' : '复制完整代码'" @click="openInstall('copy')"><Copy :size="14" aria-hidden="true" />复制代码</Button>
            <Button v-if="detail?.is_owner" size="sm" variant="outline" as-child><NuxtLink :to="'/plugin/submit?article_id=' + articleId"><Pencil :size="14" aria-hidden="true" />提交更新</NuxtLink></Button>
            <DropdownMenuRoot :modal="false">
              <DropdownMenuTrigger as-child><Button size="sm" variant="ghost" aria-label="更多操作" title="更多操作" :disabled="!detail"><MoreHorizontal :size="18" aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuPortal><DropdownMenuContent class="archive-ui plugin-more-menu" align="end" :side-offset="6" :collision-padding="8">
                <DropdownMenuItem class="plugin-more-item" @select="openReport"><Flag :size="14" aria-hidden="true" />举报插件</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
          <p v-if="showPending || copyDisabled" class="plugin-action-note">{{ showPending ? '待审核代码仅供预览，暂不能复制或下载。' : '完整代码超过 100 KiB，仅支持下载。' }}</p>
        </div>
      </header>

      <aside class="plugin-versions" aria-label="代码版本">
        <div class="archive-card plugin-version-panel">
          <h2><Clock3 :size="18" aria-hidden="true" />代码版本</h2>
          <p v-if="loading" class="plugin-muted" role="status">正在加载版本…</p>
          <template v-else-if="detail">
            <div class="plugin-version-mobile"><Select aria-label="代码版本" :model-value="selectedVersionKey" :options="versionOptions" :disabled="versionLoading" @change="selectVersion" /></div>
            <ol class="plugin-timeline">
              <li v-if="detail.pending_application"><button type="button" :class="{ selected: showPending }" :aria-current="showPending ? 'true' : undefined" :disabled="versionLoading" @click="selectVersion('pending')"><span class="plugin-version-dot" aria-hidden="true" /><span>v{{ detail.pending_application.snapshot.version }}</span><small>待审核 · 仅授权用户可见</small></button></li>
              <li v-for="version in detail.versions" :key="version.id"><button type="button" :class="{ selected: !showPending && selectedVersion?.id === version.id }" :aria-current="!showPending && selectedVersion?.id === version.id ? 'true' : undefined" :disabled="versionLoading" @click="selectVersion(String(version.id))"><span class="plugin-version-dot" aria-hidden="true" /><span>v{{ version.version }}<small v-if="version.is_current" class="plugin-latest">最新</small></span><time v-if="version.published_at" :datetime="version.published_at">{{ format(version.published_at, 'YYYY/M/D HH:mm') }}</time></button></li>
            </ol>
            <p v-if="!versionOptions.length" class="plugin-muted">暂无代码版本</p>
          </template>
          <p v-else class="plugin-muted">版本暂不可用</p>
          <p v-if="versionLoading" class="plugin-version-status" role="status"><LoaderCircle :size="14" class="plugin-spinner" aria-hidden="true" />正在读取版本…</p>
          <p v-if="versionError" class="plugin-error" role="alert">{{ versionError }}</p>
        </div>
      </aside>

      <main class="plugin-content">
        <div v-if="loading" class="archive-card plugin-state" role="status">正在读取插件…</div>
        <div v-else-if="errorText" class="archive-card plugin-state" role="alert"><h2>无法读取插件</h2><p>{{ errorText }}</p><Button variant="outline" size="sm" @click="load"><RefreshCw :size="14" aria-hidden="true" />重新读取</Button></div>
        <template v-else-if="detail && article">
          <div v-if="detail.can_claim" class="plugin-notice"><div><strong>此插件可能为你所有</strong><p>文章作者与你绑定的洛谷账号一致，认领后可管理和更新。</p><p v-if="claimError" class="plugin-error" role="alert">{{ claimError }}</p></div><Button size="sm" variant="outline" :disabled="claiming" @click="claimPlugin">{{ claiming ? '认领中…' : '认领' }}</Button></div>
          <div v-if="detail.pending_application" class="plugin-notice"><div><strong>{{ showPending ? '正在预览待审核版本 v' + detail.pending_application.snapshot.version : '你有一个待审核的更新' }}</strong><p>{{ showPending ? '此预览仅授权用户可见，审核通过前不会替换公开版本。' : '当前查看的是已审核代码，待审核内容尚未公开。' }}</p></div><Button v-if="!showPending || detail.current" size="sm" variant="outline" :disabled="versionLoading" @click="selectVersion(showPending && detail.current ? String(detail.current.id) : 'pending')">{{ showPending ? '查看正式版' : '查看待审核版' }}</Button></div>
          <div v-if="!detail.is_listed" class="plugin-notice plugin-warning" role="status"><div><strong>插件已下架</strong><p>{{ detail.down_reason || '该插件暂不在广场公开展示。' }}</p></div></div>
          <Tabs v-model="activeTab" class="plugin-content-tabs">
            <nav class="plugin-tabbar" aria-label="插件内容">
              <TabsList aria-label="插件内容"><TabsTrigger value="article"><FileText :size="15" aria-hidden="true" />插件介绍</TabsTrigger><TabsTrigger value="code"><Code2 :size="15" aria-hidden="true" />代码</TabsTrigger><TabsTrigger value="analysis"><ShieldCheck :size="15" aria-hidden="true" />请求分析</TabsTrigger></TabsList>
              <a class="plugin-original" :href="'/article/' + articleId" target="_blank" rel="noopener noreferrer">原文<ExternalLink :size="13" aria-hidden="true" /></a>
            </nav>
            <TabsContent value="article" class="archive-card plugin-reading">
              <ArticleAdminNote :note="article.admin_note" />
              <p v-if="article.content_md && !articleHtml" class="plugin-muted" role="status">正在渲染介绍…</p>
              <article v-else ref="articleRef" class="lg-content plugin-markdown" v-html="articleHtml" />
              <p v-if="!article.content_md" class="plugin-muted">暂无插件介绍</p>
            </TabsContent>
            <TabsContent value="code" class="archive-card plugin-code-panel" :aria-busy="versionLoading">
              <template v-if="displayVersion">
                <header class="plugin-code-heading"><h2>源代码 <span>v{{ displayVersion.version }}</span></h2><span>{{ codeSize(displayVersion.code_bytes) }}</span></header>
                <p v-if="codePreview.truncated" class="plugin-code-notice" role="status">代码已截断显示：最多 1,000 行且不超过 50 KiB，完整代码未被修改。</p>
                <pre v-if="codePreview.code" class="plugin-code-view" tabindex="0" aria-label="源代码预览"><code>{{ codePreview.code }}</code></pre>
                <p v-else class="plugin-muted">此版本没有代码内容</p>
                <details class="plugin-technical"><summary>技术详情<ChevronDown :size="14" aria-hidden="true" /></summary><dl><div><dt>文件名</dt><dd>{{ displayVersion.download_filename }}</dd></div><div><dt>代码大小</dt><dd>{{ codeSize(displayVersion.code_bytes) }}</dd></div><div><dt>SHA-256</dt><dd><code>{{ displayVersion.code_sha256 }}</code></dd></div></dl></details>
              </template>
              <p v-else class="plugin-muted">暂无可查看的代码版本</p>
            </TabsContent>
            <TabsContent value="analysis" class="archive-card plugin-analysis">
              <template v-if="displayVersion">
                <section><h2>上传者请求分析</h2><div class="plugin-analysis-level"><span>用户提交等级</span><PluginRequestLevelBadge :level="displayVersion.user_request_level" /></div><div v-if="displayVersion.user_request_analysis" class="lg-content" v-html="userAnalysisHtml" /><p v-else class="plugin-muted">上传者未填写请求分析。</p></section>
                <section v-if="displayVersion.admin_request_level !== null || displayVersion.admin_request_analysis"><h2>管理组请求分析</h2><div v-if="displayVersion.admin_request_level !== null" class="plugin-analysis-level"><span>管理员调整后的显示等级</span><PluginRequestLevelBadge :level="displayVersion.admin_request_level" /></div><div v-if="displayVersion.admin_request_analysis" class="lg-content" v-html="adminAnalysisHtml" /><p v-else class="plugin-muted">管理组未补充文字分析。</p></section>
              </template>
              <p v-else class="plugin-muted">暂无请求分析</p>
            </TabsContent>
          </Tabs>
        </template>
      </main>

      <aside class="plugin-sidebar" aria-label="插件信息">
        <div class="plugin-sidebar-stack">
          <details class="archive-card plugin-info" :open="infoOpen" @toggle="infoOpen = ($event.target as HTMLDetailsElement).open">
            <summary><Info :size="18" aria-hidden="true" /><h2>插件信息</h2><ChevronDown :size="14" class="plugin-info-chevron" aria-hidden="true" /></summary>
            <template v-if="displayVersion"><div class="plugin-info-level"><span class="plugin-label">请求等级</span><PluginRequestLevelBadge :level="displayVersion.final_request_level" /></div><dl><div><dt>运行方式</dt><dd>{{ runtimeMode(displayVersion.runtime_mode) }}</dd></div><div><dt>兼容设备</dt><dd>{{ compatibility }}</dd></div><div v-if="detail?.total_usage !== undefined"><dt>累计使用</dt><dd>{{ detail.total_usage }}</dd></div></dl></template>
            <p v-else class="plugin-muted">{{ loading ? '正在读取…' : '暂无版本信息' }}</p>
          </details>
          <ArchiveDocumentToc v-if="activeTab === 'article' && !loading" :content="articleRef" />
        </div>
      </aside>
    </div>
    <p v-if="toast" class="plugin-toast" role="status">{{ toast }}</p>
    <Dialog :open="reportOpen" title="举报插件" description="请说明具体问题，帮助管理员核实。" :locked="reporting" @update:open="reportOpen = $event">
      <form id="plugin-report-form" class="plugin-report-fields" @submit.prevent="submitReport"><label for="plugin-report-type">举报类型</label><Select id="plugin-report-type" v-model="reportType" :options="reportOptions" :disabled="reporting" /><label for="plugin-report-description">具体说明</label><Textarea id="plugin-report-description" v-model="reportDescription" :disabled="reporting" minlength="10" maxlength="5000" rows="6" placeholder="请至少填写 10 个字的具体说明" required :aria-invalid="Boolean(reportError)" :aria-describedby="reportError ? 'plugin-report-error' : undefined" /><p v-if="reportError" id="plugin-report-error" class="plugin-error" role="alert">{{ reportError }}</p></form>
      <template #footer><Button variant="outline" :disabled="reporting" @click="reportOpen = false">取消</Button><Button type="submit" form="plugin-report-form" class="plugin-primary" :disabled="reporting"><Flag :size="14" aria-hidden="true" />{{ reporting ? '正在提交…' : '提交举报' }}</Button></template>
    </Dialog>
    <PluginInstallConfirm v-if="displayVersion && detail" :key="selectedVersionKey" :open="confirmOpen" :article-id="articleId" :plugin-name="displayName" :version="displayVersion" :action="action" :public-download="detail.is_listed" @close="confirmOpen = false" @done="showToast" @analysis="activeTab = 'analysis'; confirmOpen = false" />
  </div>
</template>

<style scoped>
:global(html:has(.plugin-page)), :global(body:has(.plugin-page)) { overflow-x: clip; }
:global(html:has(.plugin-page)) { scrollbar-gutter: stable; }
.plugin-page { width: min(100%, 1380px); min-width: 0; margin: 0 auto; }
.plugin-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr) 220px; grid-template-areas: 'versions heading info' 'versions content info'; gap: 16px; align-items: start; min-width: 0; }
.plugin-heading { grid-area: heading; display: grid; gap: 16px; min-width: 0; }
.plugin-title-block { display: block; padding: 22px 24px; }
.plugin-title-block h1 { margin: 0 0 18px; font-size: 28px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
.plugin-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; font-size: 13px; }
.plugin-author { display: flex; gap: 10px; align-items: center; min-width: 0; margin-right: auto; }
.plugin-author > a:first-child { display: inline-flex; flex: 0 0 36px; width: 36px; height: 36px; overflow: hidden; border-radius: 50%; text-decoration: none; }
.plugin-author-name, .plugin-published { display: grid; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.plugin-author :deep(.lg-user-wrap) { flex-wrap: wrap; }
.plugin-avatar { display: block; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.plugin-avatar-fallback { display: grid; place-items: center; background: var(--hover); color: var(--text-muted); }
.plugin-label, .plugin-muted { color: var(--text-muted); font-size: 13px; }
.plugin-label { font-size: 12px; }
.plugin-tags { margin-top: 14px; }
.plugin-toolbar { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 20px; }
.plugin-updated { margin-right: auto; color: var(--text-muted); font-size: 12px; }
.plugin-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.plugin-page .plugin-primary, :global(.archive-ui .plugin-primary) { background: var(--link); color: #fff; }
.plugin-page .plugin-primary:hover, :global(.archive-ui .plugin-primary:hover) { background: color-mix(in srgb, var(--link) 88%, #000); color: #fff; }
.plugin-action-note { flex-basis: 100%; margin: 0; color: var(--text-muted); font-size: 12px; }
.plugin-versions { grid-area: versions; align-self: stretch; min-width: 0; }
.plugin-version-panel { position: sticky; top: 18px; display: block; padding: 20px; max-height: calc(100vh - 36px); overflow-y: auto; scrollbar-width: thin; }
.plugin-version-panel h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 20px; font-size: 15px; font-weight: 600; }
.plugin-version-panel h2 svg, .plugin-info summary > svg { color: var(--text-muted); flex-shrink: 0; }
.plugin-timeline { list-style: none; margin: 0; padding: 0; }
.plugin-timeline li { position: relative; padding-left: 24px; }
.plugin-timeline li:not(:last-child)::before { content: ''; position: absolute; left: 6px; top: 10px; bottom: -10px; width: 1px; background: var(--border); }
.plugin-timeline button { position: relative; display: grid; gap: 5px; width: 100%; border: 0; padding: 0 0 22px; background: transparent; color: var(--text); text-align: left; font: inherit; font-size: 13px; cursor: pointer; overflow-wrap: anywhere; }
.plugin-timeline li:last-child button { padding-bottom: 0; }
.plugin-timeline button:disabled { opacity: .55; cursor: wait; }
.plugin-timeline button:focus-visible, .plugin-info summary:focus-visible { outline: 2px solid var(--link); outline-offset: 4px; }
.plugin-timeline time, .plugin-timeline small { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.plugin-latest { margin-left: 8px; }
.plugin-version-dot { position: absolute; left: -24px; top: 3px; width: 14px; height: 14px; border: 2px solid var(--text-muted); border-radius: 50%; background: var(--surface); }
.plugin-timeline .selected { color: var(--link); }
.plugin-timeline .selected .plugin-version-dot { border-color: var(--link); }
.plugin-version-mobile { display: none; }
.plugin-version-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
.plugin-content { grid-area: content; display: grid; gap: 16px; min-width: 0; }
.plugin-content-tabs { min-width: 0; }
.plugin-tabbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
.plugin-tabbar :deep(.archive-tabs-list) { display: flex; gap: 16px; padding: 0; border-radius: 0; background: transparent; min-width: 0; }
.plugin-tabbar :deep(.archive-tabs-trigger) { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 0; border-radius: 0; border-bottom: 2px solid transparent; color: var(--text-muted); white-space: nowrap; background: transparent; box-shadow: none; }
.plugin-tabbar :deep(.archive-tabs-trigger[data-state=active]) { border-bottom-color: var(--link); color: var(--link); }
.plugin-original { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; font-size: 12px; text-decoration: none; }
.plugin-reading, .plugin-code-panel, .plugin-analysis { display: block; min-width: 0; padding: 24px; margin: 0; }
.plugin-content-tabs :deep(.archive-tabs-content[hidden]) { display: none; }
.plugin-markdown { min-width: 0; overflow-wrap: anywhere; }
.plugin-code-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.plugin-code-heading h2 { margin: 0; font-size: 16px; }
.plugin-code-heading > span, .plugin-code-heading h2 span { color: var(--text-muted); font-size: 12px; font-weight: 400; }
.plugin-code-heading h2 span { margin-left: 6px; }
.plugin-code-notice { margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 4px; background: var(--hover); color: var(--text-muted); font-size: 13px; }
.plugin-code-view { max-height: 640px; overflow: auto; margin: 0; padding: 16px; background: var(--hover); border-radius: 4px; font-size: 12px; line-height: 1.65; tab-size: 2; white-space: pre; scrollbar-width: thin; }
.plugin-code-view:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.plugin-technical { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 13px; }
.plugin-technical summary { display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none; color: var(--text-muted); }
.plugin-technical summary::-webkit-details-marker, .plugin-info summary::-webkit-details-marker { display: none; }
.plugin-technical[open] summary svg { transform: rotate(180deg); }
.plugin-technical dl { display: grid; gap: 12px; margin: 16px 0 0; }
.plugin-technical dt { color: var(--text-muted); font-size: 12px; margin-bottom: 4px; }
.plugin-technical dd { margin: 0; overflow-wrap: anywhere; }
.plugin-technical code { font-size: 11px; }
.plugin-analysis h2 { font-size: 17px; margin: 0 0 16px; }
.plugin-analysis > section + section { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--border); }
.plugin-analysis-level { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; font-size: 13px; color: var(--text-muted); }
.plugin-sidebar { grid-area: info; align-self: stretch; min-width: 0; }
.plugin-sidebar-stack { position: sticky; top: 18px; display: grid; gap: 16px; max-height: calc(100vh - 36px); overflow-y: auto; scrollbar-width: thin; }
.plugin-info { display: block; padding: 20px; }
.plugin-info summary { display: flex; align-items: center; gap: 9px; list-style: none; cursor: pointer; }
.plugin-info h2 { margin: 0; font-size: 15px; font-weight: 600; }
.plugin-info-chevron { margin-left: auto; }
.plugin-info[open] .plugin-info-chevron { transform: rotate(180deg); }
.plugin-info-level { display: grid; justify-items: start; gap: 8px; margin: 20px 0; }
.plugin-info dl { display: grid; gap: 14px; margin: 0; font-size: 13px; }
.plugin-info dl > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
.plugin-info dt { color: var(--text-muted); }
.plugin-info dd { margin: 0; overflow-wrap: anywhere; }
.plugin-sidebar-stack :deep(.document-toc-nav) { max-height: none; overflow: visible; }
.plugin-sidebar-stack :deep(.document-toc-nav a) { font-size: 12px; }
.plugin-notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: 13px; }
.plugin-notice strong { font-weight: 600; }
.plugin-notice p { color: var(--text-muted); margin: 6px 0 0; line-height: 1.6; }
.plugin-warning strong, .plugin-error, .plugin-notice .plugin-error { color: var(--lg-red); }
.plugin-error { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.plugin-state { display: block; padding: 28px 24px; min-height: 180px; font-size: 14px; }
.plugin-state h2 { margin: 0 0 12px; font-size: 18px; }
.plugin-state > button { margin-top: 12px; }
.plugin-report-fields { display: grid; gap: 10px; font-size: 14px; }
.plugin-report-fields label:not(:first-child) { margin-top: 8px; }
.plugin-report-fields p { margin: 0; }
.plugin-toast { position: fixed; z-index: 1100; bottom: 24px; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100vw - 32px); margin: 0; padding: 12px 18px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); box-shadow: 0 6px 20px #0002; font-size: 13px; overflow-wrap: anywhere; }
:global(.plugin-more-menu) { min-width: 150px; z-index: 100; padding: 5px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); box-shadow: 0 6px 18px #0002; transform-origin: var(--reka-dropdown-menu-content-transform-origin); }
:global(.plugin-more-menu[data-state=open]) { animation: plugin-menu-in 160ms cubic-bezier(.16, 1, .3, 1) both; }
:global(.plugin-more-menu[data-state=closed]) { animation: plugin-menu-out 100ms ease-in both; pointer-events: none; }
:global(.plugin-more-item) { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 4px; cursor: pointer; outline: none; font-size: 13px; }
:global(.plugin-more-item[data-highlighted]) { background: var(--hover); color: var(--link); }
.plugin-spinner { animation: plugin-spin 1s linear infinite; }
@keyframes plugin-spin { to { transform: rotate(360deg); } }
@keyframes plugin-menu-in { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes plugin-menu-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-2px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { .plugin-spinner { animation: none; } :global(.plugin-more-menu[data-state]) { animation: none; } }
@media (max-width: 1150px) {
  .plugin-layout { grid-template-columns: 190px minmax(0, 1fr); grid-template-areas: 'versions heading' 'versions info' 'versions content'; }
  .plugin-sidebar-stack { position: static; max-height: none; overflow: visible; }
  .plugin-sidebar-stack :deep(.document-toc-nav) { display: none; }
  .plugin-info dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .plugin-layout { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'heading' 'versions' 'info' 'content'; gap: 12px; }
  .plugin-heading { gap: 12px; }
  .plugin-title-block, .plugin-reading, .plugin-analysis, .plugin-code-panel { padding: 20px 16px; }
  .plugin-title-block h1 { font-size: 24px; }
  .plugin-meta { gap: 16px 24px; }
  .plugin-author { flex-basis: 100%; }
  .plugin-toolbar { padding: 12px 16px; }
  .plugin-version-panel { position: static; max-height: none; padding: 16px; }
  .plugin-version-panel h2 { margin-bottom: 12px; }
  .plugin-version-mobile { display: block; }
  .plugin-timeline { display: none; }
  .plugin-info { padding: 16px; }
  .plugin-info dl { grid-template-columns: minmax(0, 1fr); }
  .plugin-tabbar { flex-wrap: wrap; gap: 4px 12px; }
  .plugin-tabbar :deep(.archive-tabs-list) { gap: 14px; flex-wrap: wrap; }
  .plugin-tabbar :deep(.archive-tabs-trigger) { font-size: 13px; }
  .plugin-original { margin-left: auto; margin-bottom: 8px; }
  .plugin-actions { margin-left: 0; }
  .plugin-updated { flex-basis: 100%; }
}
</style>
