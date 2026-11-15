<script setup lang="ts">
import {
  ArrowLeftRight, BadgeCheck, ChevronDown, ChevronLeft, Clock3, Code2, Download,
  ExternalLink, FileText, Flag, GitPullRequest, Puzzle, RefreshCw,
  ShieldAlert, Sparkles,
} from 'lucide-vue-next'
import type { PluginDetail, PluginSnapshot, PluginVersion } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'
import { languageFromFilename } from '~/utils/codeHighlight'
import { buildLineDiff, type DiffRow } from '~/utils/lineDiff'

const route = useRoute()
const articleId = String(route.params.article_id)
const auth = useAuthStore()
const api = useApi()
const { format, smart } = useTime()
const { runtimeMode } = usePluginLabels()

const loading = ref(true)
const errorText = ref('')
const detail = ref<PluginDetail | null>(null)
const article = ref<any>(null)
const selectedVersion = ref<PluginVersion | null>(null)
const showPending = ref(false)
const activeTab = ref('article')
const articleRef = ref<HTMLElement | null>(null)
const action = ref<'copy' | 'download'>('copy')
const confirmOpen = ref(false)
const toast = ref('')
const reportOpen = ref(false)
const reportType = ref('dangerous_request')
const reportDescription = ref('')
const claiming = ref(false)
const claimError = ref('')
const riskOpen = ref(false)
const riskAccepted = ref(false)
const installing = ref(false)
const codeHistoryOpen = ref(true)
const articleHistoryOpen = ref(true)
/* 介绍（原文）历史版本：与代码版本完全独立的两条时间线，对比时也互不混用。 */
const articleHistory = ref<ArticleHistoryEntry[]>([])
const articleVersionId = ref<number | null>(null)
let media: MediaQueryList | undefined
useCopyCode(articleRef)

interface ArticleHistoryEntry {
  id: number | null
  title: string | null
  content_md: string
  crawled_at: string
  is_current: boolean
}
interface ArticleVersionRow extends ArticleHistoryEntry { number: number }

const tabs = [
  { id: 'article', label: '原文' },
  { id: 'code', label: '代码' },
  { id: 'analysis', label: '请求分析' },
]
const reportOptions = [
  { value: 'dangerous_request', label: '危险请求' },
  { value: 'malicious_code', label: '恶意代码' },
  { value: 'broken', label: '失效' },
  { value: 'copyright', label: '侵权' },
  { value: 'misleading', label: '信息不实' },
  { value: 'other', label: '其他' },
]

const safeDetail = computed(() => detail.value as PluginDetail)
const pendingSnapshot = computed(() => detail.value?.pending_application?.snapshot || null)
const displaySnapshot = computed<PluginSnapshot | null>(() => showPending.value ? pendingSnapshot.value : null)
const displayName = computed(() => article.value?.title || detail.value?.name || '插件')
const displayTags = computed(() => showPending.value
  ? detail.value?.pending_application?.tags || []
  : detail.value?.tags || [])
const updatedAt = computed(() => detail.value?.updated_at || article.value?.last_crawled_at || '')
const versionRows = computed(() => [...(detail.value?.versions || [])].sort((a, b) =>
  (new Date(b.published_at).getTime() || 0) - (new Date(a.published_at).getTime() || 0) || b.id - a.id))
/* 介绍版本按时间倒序，number 用「旧→新」序号，和 /article 的版本号一致。 */
const articleVersionRows = computed<ArticleVersionRow[]>(() => {
  const rows = [...articleHistory.value].sort((a, b) =>
    (new Date(b.crawled_at).getTime() || 0) - (new Date(a.crawled_at).getTime() || 0)
    || (b.id || 0) - (a.id || 0))
  return rows.map((row, index) => ({ ...row, number: rows.length - index }))
})
const selectedArticleVersion = computed(() =>
  articleVersionId.value === null
    ? null
    : articleVersionRows.value.find(row => row.id === articleVersionId.value) || null)
const articleMarkdown = computed(() => selectedArticleVersion.value?.content_md ?? article.value?.content_md ?? '')

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

const codePreview = computed(() => ({ code: displayVersion.value?.code || '', truncated: displayVersion.value?.code_truncated ?? false }))
const copyDisabled = computed(() => (displayVersion.value?.code_bytes ?? 0) > PLUGIN_CODE_COPY_MAX_BYTES)
const versionOptions = computed(() => {
  const options = [] as { value: string; label: string }[]
  if (showPending.value) options.push({ value: 'pending', label: `v${displayVersion.value?.version ?? ''} · 待审核` })
  for (const version of detail.value?.versions || []) {
    options.push({ value: String(version.id), label: `v${version.version}${version.is_current ? ' · 当前正式版' : ''}` })
  }
  return options
})
const selectedVersionValue = computed(() => showPending.value ? 'pending' : String(displayVersion.value?.id ?? ''))
const isUserscript = computed(() => (displayVersion.value?.download_filename || '').toLowerCase().endsWith('.user.js'))
const needsRiskNotice = computed(() => (displayVersion.value?.final_request_level ?? 0) >= 2)
const riskKey = computed(() => `plugin-risk:${articleId}:${displayVersion.value?.final_request_level ?? 0}`)
const codeLanguage = computed(() => languageFromFilename(displayVersion.value?.download_filename || 'plugin.user.js'))
const isSelectedVersion = (id: number) => !showPending.value && displayVersion.value?.id === id
const isSelectedArticleVersion = (row: ArticleVersionRow) =>
  articleVersionId.value === null ? row.is_current : row.id === articleVersionId.value

/* ---------- 版本对比：代码只对比代码，介绍只对比介绍 ---------- */
const compareOpen = ref(false)
const compareKind = ref<'code' | 'article'>('code')
const compareOnlyChanges = ref(true)
const compareLeftId = ref('')
const compareRightId = ref('')
const compareLoading = ref(false)
const compareLeftText = ref('')
const compareRightText = ref('')
const codeCache = new Map<number, string>()

const codeCompareOptions = computed(() => versionRows.value.map(version => ({
  value: String(version.id),
  label: `v${version.version}${version.published_at ? ' · ' + format(version.published_at, 'YYYY/MM/DD HH:mm') : ''}${version.is_current ? ' · 当前' : ''}`,
})))
const articleCompareOptions = computed(() => articleVersionRows.value.map(row => ({
  value: String(row.id),
  label: `版本 ${row.number}${row.crawled_at ? ' · ' + format(row.crawled_at, 'YYYY/MM/DD HH:mm') : ''}${row.is_current ? ' · 最新' : ''}`,
})))
const compareOptions = computed(() => compareKind.value === 'code' ? codeCompareOptions.value : articleCompareOptions.value)
const compareRows = computed<DiffRow[]>(() => buildLineDiff(compareLeftText.value, compareRightText.value))
const compareChanges = computed(() => compareRows.value.filter(row => row.kind !== 'same').length)
const compareAdds = computed(() => compareRows.value.filter(row => row.kind === 'add' || row.kind === 'change').length)
const compareRemoves = computed(() => compareRows.value.filter(row => row.kind === 'remove' || row.kind === 'change').length)
const visibleCompareRows = computed(() => {
  if (!compareOnlyChanges.value) return compareRows.value
  const keep = new Set<number>()
  compareRows.value.forEach((row, index) => {
    if (row.kind === 'same') return
    for (let offset = -2; offset <= 2; offset += 1) {
      const target = index + offset
      if (target >= 0 && target < compareRows.value.length) keep.add(target)
    }
  })
  return compareRows.value.filter((_, index) => keep.has(index))
})

async function versionCode(id: number): Promise<string> {
  const cached = codeCache.get(id)
  if (cached !== undefined) return cached
  const data = await api<PluginVersion>(`/plugins/${articleId}/versions/${id}`)
  codeCache.set(id, data.code || '')
  return data.code || ''
}

async function loadCompareTexts() {
  if (compareKind.value === 'article') {
    compareLeftText.value = articleVersionRows.value.find(row => String(row.id) === compareLeftId.value)?.content_md || ''
    compareRightText.value = articleVersionRows.value.find(row => String(row.id) === compareRightId.value)?.content_md || ''
    return
  }
  compareLoading.value = true
  try {
    const [left, right] = await Promise.all([
      versionCode(Number(compareLeftId.value)),
      versionCode(Number(compareRightId.value)),
    ])
    compareLeftText.value = left
    compareRightText.value = right
  } catch {
    showToast('版本代码读取失败，请重试')
  } finally {
    compareLoading.value = false
  }
}

async function openCompare(kind: 'code' | 'article', anchor?: string) {
  const ids = kind === 'code'
    ? versionRows.value.map(version => String(version.id))
    : articleVersionRows.value.map(row => String(row.id))
  if (ids.length < 2) {
    showToast(kind === 'code' ? '至少需要两个代码版本才能对比' : '至少需要两个介绍版本才能对比')
    return
  }
  compareKind.value = kind
  compareLeftText.value = ''
  compareRightText.value = ''
  const right = anchor && ids.includes(anchor) ? anchor : ids[0]
  const rightIndex = ids.indexOf(right)
  const left = ids[rightIndex + 1] || ids[rightIndex - 1] || ids[1]
  compareLeftId.value = left
  compareRightId.value = right
  compareOpen.value = true
  await loadCompareTexts()
}

watch([compareLeftId, compareRightId], () => { if (compareOpen.value) void loadCompareTexts() })

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
    checkRiskOnVisit()
  } catch (error: any) {
    errorText.value = error?.data?.message || '插件不存在或尚未通过审核'
  } finally {
    loading.value = false
  }
  // 介绍历史独立拉取，失败不影响插件本体展示。
  try {
    const history = await api<{ versions: ArticleHistoryEntry[] }>(`/article/${articleId}/history`)
    articleHistory.value = history?.versions || []
  } catch {
    articleHistory.value = article.value
      ? [{
          id: null,
          title: article.value.title ?? null,
          content_md: article.value.content_md || '',
          crawled_at: article.value.last_crawled_at || '',
          is_current: true,
        }]
      : []
  }
}

async function selectVersion(versionId: string) {
  if (!versionId || !detail.value) return
  if (versionId === 'pending') {
    showPending.value = true
    selectedVersion.value = detail.value.current
    return
  }
  const version = await api<PluginVersion>(`/plugins/${articleId}/versions/${versionId}`)
  selectedVersion.value = version
  if (version?.id) codeCache.set(version.id, version.code || '')
  showPending.value = false
  checkRiskOnVisit()
}

async function chooseVersion(id: number) {
  try {
    await selectVersion(String(id))
    activeTab.value = 'code'
  } catch {
    showToast('版本加载失败，请重试')
  }
}

function chooseArticleVersion(row: ArticleVersionRow) {
  articleVersionId.value = row.is_current ? null : row.id
  activeTab.value = 'article'
}
function showLatestArticle() { articleVersionId.value = null }

function openInstall(nextAction: 'copy' | 'download') {
  if (!requireRisk()) return
  if (showPending.value) {
    showToast('待审核代码仅供上传者预览，审核通过后才能复制或下载。')
    return
  }
  if (nextAction === 'copy' && copyDisabled.value) {
    showToast('完整代码超过 100 KiB，请下载文件')
    return
  }
  action.value = nextAction
  confirmOpen.value = true
}

function showToast(message: string, ms = 1800) {
  toast.value = message
  setTimeout(() => { toast.value = '' }, ms)
}

function checkRiskOnVisit() {
  if (!needsRiskNotice.value) return
  try {
    if (sessionStorage.getItem(riskKey.value) === '1') { riskAccepted.value = true; return }
  } catch { /* 隐私模式下忽略存储异常 */ }
  riskAccepted.value = false
  riskOpen.value = true
}
function requireRisk(): boolean {
  if (!needsRiskNotice.value || riskAccepted.value) return true
  riskOpen.value = true
  return false
}
function acceptRisk() {
  riskAccepted.value = true
  try { sessionStorage.setItem(riskKey.value, '1') } catch { /* 忽略 */ }
  riskOpen.value = false
}
function declineRisk() {
  riskOpen.value = false
  void navigateTo('/plugin')
}
/**
 * 安装脚本：走同源 Nitro 代理 /plugin/install/{articleId}/{versionId}/{filename}。
 * 该代理把后端代码重新以 text/javascript、无 Content-Disposition、路径以 .user.js 结尾返回，
 * 这三个条件同时满足时脚本管理器（Tampermonkey 等）才会接管安装；
 * 直接消费后端接口（attachment / text/plain）永远会被浏览器当成文件下载。
 */
async function installScript() {
  if (!requireRisk() || installing.value) return
  if (showPending.value) {
    showToast('待审核代码仅供上传者预览，审核通过后才能安装。')
    return
  }
  const version = displayVersion.value
  if (!version?.id) {
    showToast('请切换到已审核版本后再安装。')
    return
  }
  installing.value = true
  const filename = (version.download_filename || `plugin-${version.id}.user.js`).split('/').pop() || `plugin-${version.id}.user.js`
  const proxy = `/plugin/install/${encodeURIComponent(articleId)}/${version.id}/${encodeURIComponent(filename)}`
  const openLink = (url: string, target?: string, download?: string) => {
    const anchor = document.createElement('a')
    anchor.href = url
    if (target) { anchor.target = target; anchor.rel = 'noopener noreferrer' }
    if (download) anchor.download = download
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
  try {
    // 先探测代理是否可用（HEAD 不产生下载），确认 MIME 正确后再导航。
    const probe = await fetch(proxy, { method: 'HEAD', credentials: 'same-origin' })
    const type = probe.headers.get('content-type') || ''
    if (probe.ok && /javascript/i.test(type)) {
      openLink(proxy)
      showToast('已打开安装链接，脚本管理器会自动接管', 3000)
      return
    }
  } catch { /* 代理不可用，回退为直接下载文件 */ }
  try {
    const legacy = `${useApiBase()}/api/v1/plugins/${encodeURIComponent(articleId)}/download/${version.id}`
    const response = await fetch(legacy, { credentials: 'omit' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const code = await response.text()
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript;charset=utf-8' }))
    openLink(blobUrl, undefined, filename)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
    showToast(`已下载 ${filename}，拖入脚本管理器即可安装`, 4000)
  } catch {
    showToast('安装失败，请改用「下载」或稍后重试', 3000)
  } finally {
    installing.value = false
  }
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
    alert(error?.data?.message || '举报提交失败')
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

function updateHistoryLayout() {
  codeHistoryOpen.value = !media?.matches
  articleHistoryOpen.value = !media?.matches
}
onMounted(async () => {
  media = window.matchMedia('(max-width: 1080px)')
  updateHistoryLayout()
  media.addEventListener('change', updateHistoryLayout)
  if (!auth.initialized) await auth.tryRefresh()
  await load()
})
onBeforeUnmount(() => { media?.removeEventListener('change', updateHistoryLayout) })

useHead(() => ({ title: `${displayName.value} - 插件广场` }))
</script>

<template>
  <LoadingPanel v-if="loading" variant="detail" title="正在加载插件" />

  <div v-else-if="errorText" class="page">
    <div class="card doc-content">
      <EmptyState title="插件不可用" :description="errorText">
        <template #actions>
          <FButton appearance="outline" size="small" @click="load()">
            <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重新读取
          </FButton>
          <FButton appearance="outline" size="small" @click="navigateTo('/plugin')">返回插件广场</FButton>
        </template>
      </EmptyState>
    </div>
  </div>

  <div v-else-if="detail && article" class="page doc-page plugin-page">
    <!-- 与 /article 一致的文档头部 -->
    <header class="card doc-header">
      <div class="doc-header__top">
        <div class="cluster">
          <span class="tag tag--brand">插件</span>
          <span v-if="safeDetail.is_official" class="tag tag--brand"><BadgeCheck :size="12" aria-hidden="true" />官方</span>
          <span v-if="safeDetail.is_recommended" class="tag tag--warn"><Sparkles :size="12" aria-hidden="true" />推荐</span>
          <span v-if="detail.versions?.length" class="tag">共 {{ detail.versions.length }} 个版本</span>
          <span class="meta-item muted">文章编号 {{ articleId }}</span>
        </div>
        <div class="doc-toolbar">
          <FButton appearance="outline" :href="`https://www.luogu.com.cn/article/${articleId}`" target="_blank">
            <template #start><ExternalLink :size="14" aria-hidden="true" /></template>查看原文
          </FButton>
          <FButton appearance="outline" @click="navigateTo('/plugin')">
            <template #start><ChevronLeft :size="14" aria-hidden="true" /></template>插件广场
          </FButton>
        </div>
      </div>

      <div class="doc-header__main">
        <h1 class="doc-title">{{ displayName }}</h1>
        <div class="doc-meta">
          <div v-if="article.author" class="doc-author">
            <NuxtLink :to="`/user/${article.author.uid}`" class="doc-author__avatar" :aria-label="`${article.author.name} 的主页`">
              <LuoguAvatar :user="article.author" :size="34" />
            </NuxtLink>
            <div class="stack stack--xs">
              <LuoguUserName :user="article.author" show-badge />
              <span class="muted" style="font-size: 11px">作者</span>
            </div>
          </div>
          <span v-else class="muted" style="font-size: 13px">作者未收录</span>
          <span class="meta-item muted">
            <Clock3 :size="14" aria-hidden="true" />上次更新
            <time v-if="updatedAt" :datetime="updatedAt" :title="format(updatedAt, 'YYYY-MM-DD HH:mm:ss')">{{ smart(updatedAt) }}</time>
            <span v-else>—</span>
          </span>
          <span v-if="safeDetail.total_usage !== undefined" class="meta-item muted">使用 {{ safeDetail.total_usage }} 次</span>
          <PluginRequestLevelBadge v-if="displayVersion" :level="displayVersion.final_request_level" compact />
          <span v-for="tag in displayTags" :key="tag.id" class="tag">{{ tag.name }}</span>
        </div>

        <!-- 插件信息上移到标题区，与作者/更新时间同处一张卡片 -->
        <dl class="doc-facts">
          <div><dt>运行方式</dt><dd>{{ displayVersion ? runtimeMode(displayVersion.runtime_mode) : '—' }}</dd></div>
          <div><dt>兼容设备</dt><dd>{{ [displayVersion?.supports_desktop ? '桌面端' : '', displayVersion?.supports_mobile ? '移动端' : ''].filter(Boolean).join('、') || '—' }}</dd></div>
          <div><dt>下载次数</dt><dd>{{ displayVersion?.download_count ?? 0 }}</dd></div>
          <div><dt>最后验证</dt><dd>{{ displayVersion?.last_verified_on || '—' }}</dd></div>
        </dl>
      </div>
    </header>

    <div v-if="safeDetail.can_claim" class="notice notice--brand">
      <GitPullRequest :size="18" aria-hidden="true" />
      <div class="plugin-notice__body">
        <strong>此插件可能为你所有</strong>
        <p class="field-help" style="margin-top:2px">原文章作者与你绑定的洛谷账号一致，认领后可管理和更新此插件。</p>
        <p v-if="claimError" class="field-error">{{ claimError }}</p>
      </div>
      <FButton appearance="primary" size="small" :loading="claiming" @click="claimPlugin">{{ claiming ? '认领中…' : '认领' }}</FButton>
    </div>

    <div v-if="safeDetail.pending_application" class="notice notice--warn">
      <GitPullRequest :size="18" aria-hidden="true" />
      <div class="plugin-notice__body">
        <strong>当前显示的是待审核版本 v{{ safeDetail.pending_application.snapshot.version }}</strong>
        <p class="field-help" style="margin-top:2px">此版本仅你和管理员可见，公开页面仍展示上一个已审核版本。</p>
      </div>
      <FButton v-if="safeDetail.current" appearance="outline" size="small" @click="showPending = !showPending; selectedVersion = safeDetail.current">
        {{ showPending ? '切到已审核代码' : '查看待审核代码' }}
      </FButton>
    </div>

    <div v-if="!safeDetail.is_listed" class="notice notice--warn">
      <strong>插件已下架</strong>
      <span>{{ safeDetail.down_reason || '该插件暂不在广场公开展示。' }}</span>
    </div>

    <div class="doc-grid">
      <main class="card doc-content plugin-content" aria-label="插件内容">
        <FTabList v-model="activeTab" :tabs="tabs" aria-label="插件内容" class="plugin-tablist" />

        <Transition name="tab-fade" mode="out-in">
          <section v-if="activeTab === 'article'" key="article">
            <ArticleAdminNote :note="article.admin_note" />
            <div v-if="selectedArticleVersion" class="notice notice--warn plugin-history-notice">
              <FileText :size="16" aria-hidden="true" />
              <span>正在查看历史介绍「版本 {{ selectedArticleVersion.number }}」，与最新介绍可能不一致。</span>
              <FButton appearance="subtle" size="small" @click="showLatestArticle">回到最新</FButton>
            </div>
            <div ref="articleRef" class="doc-markdown-wrap">
              <MarkdownBody :source="articleMarkdown" class="markdown-body doc-markdown" />
            </div>
            <p v-if="!articleMarkdown" class="doc-state">此插件暂无原文介绍</p>
          </section>

          <section v-else-if="activeTab === 'code' && displayVersion" key="code" class="stack">
            <div class="plugin-code-head">
              <div class="stack stack--xs" style="min-width: 160px">
                <h2 class="section-title" style="display:flex;align-items:center;gap:7px"><Code2 :size="17" aria-hidden="true" />代码预览</h2>
                <span class="muted" style="font-size: 12px">{{ codePreview.code.split('\n').length }} 行 · {{ Math.ceil((displayVersion.code_bytes || 0) / 1024) }} KiB</span>
              </div>
              <div class="cluster" style="flex-wrap: wrap">
                <FButton appearance="primary" size="small" :disabled="copyDisabled" :title="copyDisabled ? '完整代码超过 100 KiB，仅支持下载' : '复制代码'" @click="openInstall('copy')">
                  复制代码
                </FButton>
                <FButton appearance="outline" size="small" @click="openInstall('download')">
                  <template #start><Download :size="14" aria-hidden="true" /></template>下载文件
                </FButton>
              </div>
            </div>
            <div v-if="codePreview.truncated" class="notice notice--warn">
              <strong>代码较长，已截断显示</strong>
              <span>页面最多展示前 1000 行且不超过 50 KiB，完整代码未被修改。</span>
            </div>
            <div v-if="copyDisabled" class="notice notice--warn">
              <strong>复制已禁用</strong>
              <span>完整代码超过 100 KiB，请下载文件。</span>
            </div>
            <CodeHighlight :code="codePreview.code" :language="codeLanguage" max-height="620px" />
            <p v-if="displayVersion?.code_sha256" class="plugin-code-hash">
              <span class="muted">SHA-256</span><code class="code-inline">{{ displayVersion.code_sha256 }}</code>
            </p>
          </section>

          <section v-else-if="activeTab === 'analysis' && displayVersion" key="analysis" class="stack stack--lg">
            <div class="level-comparison" :class="{ single: displayVersion.admin_request_level === null }">
              <div><span class="muted">用户提交等级</span><PluginRequestLevelBadge :level="displayVersion.user_request_level" /></div>
              <div v-if="displayVersion.admin_request_level !== null">
                <span class="muted">管理员更改等级</span>
                <PluginRequestLevelBadge :level="displayVersion.admin_request_level" />
              </div>
            </div>
            <section class="stack">
              <h2 class="section-title">上传者请求分析</h2>
              <MarkdownBody :source="displayVersion.user_request_analysis" class="markdown-body doc-markdown" />
            </section>
            <section v-if="displayVersion.admin_request_analysis" class="stack" style="padding-top:16px;border-top:1px solid var(--colorNeutralStroke2)">
              <h2 class="section-title">管理组请求分析</h2>
              <MarkdownBody :source="displayVersion.admin_request_analysis" class="markdown-body doc-markdown" />
            </section>
          </section>
        </Transition>
      </main>

      <aside class="doc-side">
        <div class="card plugin-side-card">
          <h2 class="plugin-side-card__title"><Puzzle :size="16" aria-hidden="true" />安装与下载</h2>
          <FSelect
            :model-value="selectedVersionValue"
            :options="versionOptions"
            size="small"
            aria-label="代码版本"
            @update:model-value="selectVersion"
          />
          <div class="plugin-side-actions">
            <FButton v-if="isUserscript && displayVersion" appearance="primary" block :loading="installing" :disabled="installing" @click="installScript">
              <template #start><Puzzle :size="14" aria-hidden="true" /></template>{{ installing ? '安装中…' : '安装脚本' }}
            </FButton>
            <FButton appearance="outline" block size="small" :disabled="copyDisabled" @click="openInstall('copy')">复制代码</FButton>
            <FButton appearance="outline" block size="small" @click="openInstall('download')">
              <template #start><Download :size="14" aria-hidden="true" /></template>下载文件
            </FButton>
          </div>
          <p class="field-help plugin-side-card__note">{{ displayVersion?.download_filename || '暂无代码文件' }}</p>
        </div>

        <!-- 版本卡片跟随当前 tab：原文 → 介绍版本，代码 → 代码版本，其余 tab 不展示 -->
        <Transition name="side-swap" mode="out-in">
          <div v-if="activeTab === 'article'" key="article-versions" class="card doc-versions">
            <button
              type="button"
              class="doc-versions__summary"
              :aria-expanded="articleHistoryOpen"
              @click="articleHistoryOpen = !articleHistoryOpen"
            >
              <FileText :size="17" aria-hidden="true" />
              <span>介绍版本</span>
              <ChevronDown class="doc-versions__chevron" :class="{ 'is-open': articleHistoryOpen }" :size="16" aria-hidden="true" />
            </button>
            <div class="doc-collapse" :class="{ 'is-open': articleHistoryOpen }">
              <div class="doc-collapse__inner">
                <div class="doc-versions__body">
                  <ol v-if="articleVersionRows.length" class="doc-timeline">
                    <li v-for="row in articleVersionRows" :key="`article-${row.id ?? 'current'}`" class="doc-version-row">
                      <button
                        type="button"
                        class="doc-version"
                        :class="{ 'is-selected': isSelectedArticleVersion(row) }"
                        :aria-current="isSelectedArticleVersion(row) ? 'true' : undefined"
                        @click="chooseArticleVersion(row)"
                      >
                        <span class="doc-version__dot" aria-hidden="true" />
                        <span class="doc-version__heading">
                          版本 {{ row.number }}
                          <span v-if="row.is_current" class="tag tag--brand" style="font-size: 10px">最新</span>
                        </span>
                        <time v-if="row.crawled_at" :datetime="row.crawled_at">{{ format(row.crawled_at, 'YYYY/M/D HH:mm') }}</time>
                        <time v-else>—</time>
                      </button>
                      <button
                        type="button"
                        class="doc-version-compare"
                        title="对比此介绍版本（仅与介绍对比）"
                        aria-label="对比此介绍版本"
                        :disabled="articleVersionRows.length < 2"
                        @click.stop="openCompare('article', String(row.id))"
                      >
                        <ArrowLeftRight :size="13" aria-hidden="true" />
                      </button>
                    </li>
                  </ol>
                  <p v-else class="doc-state">暂无历史介绍</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'code'" key="code-versions" class="card doc-versions">
            <button
              type="button"
              class="doc-versions__summary"
              :aria-expanded="codeHistoryOpen"
              @click="codeHistoryOpen = !codeHistoryOpen"
            >
              <Clock3 :size="17" aria-hidden="true" />
              <span>代码版本</span>
              <ChevronDown class="doc-versions__chevron" :class="{ 'is-open': codeHistoryOpen }" :size="16" aria-hidden="true" />
            </button>
            <div class="doc-collapse" :class="{ 'is-open': codeHistoryOpen }">
              <div class="doc-collapse__inner">
                <div class="doc-versions__body">
                  <ol v-if="versionRows.length" class="doc-timeline">
                    <li v-for="version in versionRows" :key="version.id" class="doc-version-row">
                      <button
                        type="button"
                        class="doc-version"
                        :class="{ 'is-selected': isSelectedVersion(version.id) }"
                        :aria-current="isSelectedVersion(version.id) ? 'true' : undefined"
                        @click="chooseVersion(version.id)"
                      >
                        <span class="doc-version__dot" aria-hidden="true" />
                        <span class="doc-version__heading">
                          v{{ version.version }}
                          <span v-if="version.is_current" class="tag tag--brand" style="font-size: 10px">当前</span>
                        </span>
                        <time v-if="version.published_at" :datetime="version.published_at">{{ format(version.published_at, 'YYYY/M/D HH:mm') }}</time>
                        <time v-else>—</time>
                      </button>
                      <button
                        type="button"
                        class="doc-version-compare"
                        title="对比此代码版本（仅与代码对比）"
                        aria-label="对比此代码版本"
                        :disabled="versionRows.length < 2"
                        @click.stop="openCompare('code', String(version.id))"
                      >
                        <ArrowLeftRight :size="13" aria-hidden="true" />
                      </button>
                    </li>
                  </ol>
                  <p v-else class="doc-state">暂无历史版本</p>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <div v-if="activeTab === 'article'" class="card doc-toc-card">
          <ArchiveDocumentToc :content="articleRef" />
        </div>
      </aside>
    </div>

    <footer class="detail-footer">
      <span class="muted" style="font-size: 12px">文章编号 {{ articleId }}</span>
      <div class="cluster">
        <NuxtLink v-if="article.version_count > 1" :to="`/article/${articleId}/history`" class="muted" style="font-size:12px">历史版本</NuxtLink>
        <FButton v-if="safeDetail.is_owner" appearance="outline" size="small" @click="navigateTo(`/plugin/submit?article_id=${articleId}`)">提交更新</FButton>
        <FButton appearance="subtle" size="small" @click="reportOpen = true">
          <template #start><Flag :size="14" aria-hidden="true" /></template>举报插件
        </FButton>
      </div>
    </footer>

    <FDialog v-model:open="reportOpen" title="举报插件">
      <form class="dialog-form" @submit.prevent="submitReport">
        <div class="stack stack--xs">
          <label class="field-label" for="report-type">举报类型</label>
          <FSelect id="report-type" v-model="reportType" :options="reportOptions" />
        </div>
        <div class="stack stack--xs">
          <label class="field-label" for="report-description">具体说明</label>
          <FTextarea id="report-description" v-model.trim="reportDescription" :rows="5" :minlength="10" :maxlength="5000" placeholder="请至少填写 10 个字的具体说明" required />
        </div>
        <div class="app-dialog__actions">
          <FButton appearance="outline" @click="reportOpen = false">取消</FButton>
          <FButton type="submit" appearance="primary">提交举报</FButton>
        </div>
      </form>
    </FDialog>

    <Transition name="toast">
      <p v-if="toast" class="toast" role="status">{{ toast }}</p>
    </Transition>
    <PluginInstallConfirm
      v-if="displayVersion"
      :open="confirmOpen"
      :article-id="articleId"
      :plugin-name="displayName"
      :version="displayVersion"
      :action="action"
      :public-download="safeDetail.is_listed"
      @close="confirmOpen = false"
      @done="showToast"
      @analysis="activeTab = 'analysis'; confirmOpen = false"
    />

    <FDialog v-model:open="compareOpen" :title="compareKind === 'code' ? '代码版本对比' : '介绍版本对比'" size="large">
      <div class="compare-panel">
        <div class="compare-controls">
          <FSelect v-model="compareLeftId" :options="compareOptions" :aria-label="compareKind === 'code' ? '左侧代码版本' : '左侧介绍版本'" />
          <ArrowLeftRight :size="16" class="muted" aria-hidden="true" />
          <FSelect v-model="compareRightId" :options="compareOptions" :aria-label="compareKind === 'code' ? '右侧代码版本' : '右侧介绍版本'" />
        </div>
        <div class="compare-summary">
          <span class="tag tag--success">+{{ compareAdds }}</span>
          <span class="tag tag--danger">-{{ compareRemoves }}</span>
          <span class="muted" style="font-size: 12px">共 {{ compareChanges }} 行变更</span>
          <span v-if="compareKind === 'code'" class="tag">仅代码互比</span>
          <span v-else class="tag">仅介绍互比</span>
          <FSwitch v-model="compareOnlyChanges" label="仅显示变更" style="margin-left: auto" />
        </div>
        <LoadingPanel v-if="compareLoading" variant="list" :rows="4" compact title="正在读取代码版本" />
        <div v-else-if="compareRows.length" class="compare-view">
          <div v-for="(row, index) in visibleCompareRows" :key="index" class="compare-row" :class="row.kind">
            <span class="compare-no">{{ row.leftNo || '' }}</span>
            <code class="compare-code">{{ row.left }}</code>
            <span class="compare-no">{{ row.rightNo || '' }}</span>
            <code class="compare-code">{{ row.right }}</code>
          </div>
        </div>
        <div v-else class="notice">两侧内容一致，或所选版本没有可对比的文本。</div>
      </div>
      <template #actions>
        <FButton appearance="outline" @click="compareOpen = false">关闭</FButton>
      </template>
    </FDialog>

    <FDialog v-model:open="riskOpen" title="是否继续使用此脚本？" size="medium">
      <div class="stack">
        <div class="notice notice--warn">
          <ShieldAlert :size="18" aria-hidden="true" />
          <span>你是否需要这个脚本，此脚本有较多的请求等级，可能会影响你的洛谷账号</span>
        </div>
        <p class="field-help">当前版本请求等级为 {{ displayVersion?.final_request_level ?? 0 }}。建议先阅读请求分析，确认脚本的网络请求行为后再安装。</p>
      </div>
      <template #actions>
        <div class="risk-actions">
          <FButton appearance="subtle" size="small" @click="declineRisk">返回插件广场</FButton>
          <FButton appearance="outline" size="small" @click="activeTab = 'analysis'; acceptRisk()">查看请求分析</FButton>
          <FButton appearance="primary" size="small" @click="acceptRisk">我了解，继续</FButton>
        </div>
      </template>
    </FDialog>
  </div>
</template>

<style scoped>
/* 布局骨架与 /article（ArchiveDocumentPage）保持一致 */
.doc-header { padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; }
.doc-header__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 18px; flex-wrap: wrap; }
.doc-header__main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.doc-meta { display: flex; align-items: center; justify-content: flex-start; gap: 12px 16px; flex-wrap: wrap; }
/* 标题区的插件信息条：紧凑横排，窄屏自动换行 */
.doc-facts {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 20px;
  margin: 0; padding-top: 12px; border-top: 1px solid var(--colorNeutralStroke2);
}
.doc-facts > div { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.doc-facts dt { color: var(--colorNeutralForeground3); font-size: 12px; white-space: nowrap; }
.doc-facts dd {
  margin: 0; color: var(--colorNeutralForeground1); font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
}
.doc-author { display: flex; align-items: center; gap: 10px; min-width: 0; }
.doc-author__avatar {
  width: 34px; height: 34px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
  display: grid; place-items: center;
  background: var(--colorBrandBackground2); color: var(--colorBrandForeground1);
  font-weight: 600; font-size: 14px; text-decoration: none;
}
.doc-author__avatar img { width: 34px; height: 34px; object-fit: cover; display: block; }
.doc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.doc-grid { display: grid; grid-template-columns: minmax(0, 1fr) 268px; gap: 18px; align-items: start; }
.doc-content { padding: clamp(20px, 3vw, 34px); min-height: 320px; min-width: 0; }
.doc-markdown { font-size: 15px; }
.doc-side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; max-height: calc(100dvh - 32px); overflow-y: auto; }
.doc-versions { padding: 16px; }
.doc-versions__summary {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 0;
  border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--colorNeutralForeground1); text-align: left; cursor: pointer;
}
.doc-versions__chevron { margin-left: auto; color: var(--colorNeutralForeground3); transition: transform var(--app-transition); }
.doc-versions__chevron.is-open { transform: rotate(180deg); }
/* 用 grid-template-rows 0fr→1fr 做纯 CSS 高度展开动画，避免 height 动画需要测量像素 */
.doc-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--durationNormal) var(--curveEasyEase); }
.doc-collapse.is-open { grid-template-rows: 1fr; }
.doc-collapse__inner { overflow: hidden; min-height: 0; }
.doc-collapse:not(.is-open) .doc-collapse__inner { visibility: hidden; }
.doc-versions__body { padding-top: 14px; }
/* 切换 tab 时版本卡片出入场 */
.side-swap-enter-active, .side-swap-leave-active { transition: opacity .18s ease, transform .18s ease; }
.side-swap-enter-from { opacity: 0; transform: translateY(6px); }
.side-swap-leave-to { opacity: 0; transform: translateY(-6px); }
.doc-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
/* 老文章可能有几十个版本，限制高度避免把侧栏撑得过长 */
.doc-versions__body .doc-timeline { max-height: 320px; overflow-y: auto; }
.doc-version-row { display: flex; align-items: stretch; gap: 2px; border-radius: var(--borderRadiusMedium); }
.doc-version-row:hover { background: var(--colorNeutralBackground1Hover); }
.doc-version {
  position: relative; display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-width: 0;
  width: 100%; padding: 9px 10px 9px 24px; border: 0; border-radius: var(--borderRadiusMedium);
  background: transparent; color: var(--colorNeutralForeground2); text-align: left; font: inherit;
  font-size: 12px; line-height: 1.5; cursor: pointer;
}
.doc-version:hover { background: var(--colorNeutralBackground1Hover); }
.doc-version.is-selected { background: var(--colorBrandBackground2); }
.doc-version__dot {
  position: absolute; left: 9px; top: 14px; width: 6px; height: 6px; border-radius: 50%;
  background: var(--colorNeutralStroke1);
}
.doc-version.is-selected .doc-version__dot { background: var(--colorBrandBackground); box-shadow: 0 0 0 3px var(--colorBrandBackground2); }
.doc-version__heading { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--colorNeutralForeground1); }
.doc-version time { color: var(--colorNeutralForeground3); font-size: 11px; font-variant-numeric: tabular-nums; }
.doc-version-compare {
  width: 26px; flex-shrink: 0; display: grid; place-items: center; border: 1px solid var(--colorNeutralStroke2);
  border-radius: var(--borderRadiusMedium); background: var(--colorNeutralBackground2);
  color: var(--colorNeutralForeground2); cursor: pointer;
  transition: background var(--durationFaster) var(--curveEasyEase), color var(--durationFaster) var(--curveEasyEase);
}
.doc-version-compare:hover { background: var(--colorNeutralBackground1Selected); color: var(--colorBrandForeground1); }
.doc-version-compare:disabled { opacity: .45; cursor: not-allowed; }
.plugin-history-notice { align-items: center; }
.plugin-history-notice > span { flex: 1 1 auto; }
/* 版本对比面板（与 /article 一致的双栏逐行 diff） */
.compare-panel { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.compare-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 10px; }
.compare-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.compare-view {
  max-height: min(56dvh, 560px); overflow: auto;
  border: 1px solid var(--colorNeutralStroke2);
  border-radius: var(--borderRadiusLarge);
  background: var(--colorNeutralBackground1);
  font-family: var(--fontFamilyMonospace);
  font-size: 11.5px;
  line-height: 1.55;
}
.compare-row { display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px minmax(0, 1fr); min-width: 0; }
.compare-row + .compare-row { border-top: 1px solid var(--colorNeutralStroke2); }
.compare-no { padding: 2px 6px; color: var(--colorNeutralForeground4); background: var(--colorNeutralBackground2); text-align: right; user-select: none; }
.compare-row .compare-no:nth-child(3) { border-left: 1px solid var(--colorNeutralStroke2); }
.compare-code { margin: 0; padding: 2px 8px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--colorNeutralForeground1); font: inherit; }
.compare-row.add .compare-code:nth-child(4) { background: color-mix(in srgb, var(--colorPaletteGreenBackground1, #dff6dd) 88%, transparent); box-shadow: inset 2px 0 0 #0e700e; }
.compare-row.remove .compare-code:nth-child(2) { background: color-mix(in srgb, var(--colorPaletteRedBackground1, #fde7e9) 88%, transparent); box-shadow: inset 2px 0 0 #b10e1c; }
.compare-row.change .compare-code:nth-child(2) { background: color-mix(in srgb, var(--colorPaletteRedBackground1, #fde7e9) 78%, transparent); box-shadow: inset 2px 0 0 #b10e1c; }
.compare-row.change .compare-code:nth-child(4) { background: color-mix(in srgb, var(--colorPaletteGreenBackground1, #dff6dd) 78%, transparent); box-shadow: inset 2px 0 0 #0e700e; }
.doc-toc-card { padding: 0; overflow: hidden; }
.doc-state { color: var(--colorNeutralForeground3); font-size: 14px; line-height: 1.7; padding: 12px 0; margin: 0; }

/* 插件页专属块 */
.plugin-tablist { margin-bottom: 18px; }
.plugin-code-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.plugin-notice__body { flex: 1 1 auto; min-width: 0; }
.plugin-side-card { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.plugin-side-card__title {
  display: flex; align-items: center; gap: 7px; margin: 0; font-size: 13px; font-weight: 600;
  color: var(--colorNeutralForeground1);
}
.plugin-side-card__note { margin: 0; font-size: 11px; overflow-wrap: anywhere; }
.plugin-side-actions { display: flex; flex-direction: column; gap: 6px; }
.plugin-code-hash { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; font-size: 11.5px; }
.level-comparison {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge); overflow: hidden;
  background: var(--colorNeutralStroke2);
}
.level-comparison.single { grid-template-columns: minmax(0, 1fr); }
.level-comparison > div { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; background: var(--colorNeutralBackground1); }
.detail-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
/* 三个操作按钮固定同一行，避免小弹窗里 flex-wrap 造成错位。 */
.risk-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: nowrap; }
.risk-actions :deep(.f-button__label) { white-space: nowrap; }
.toast {
  position: fixed; z-index: 900; left: 50%; bottom: calc(28px + env(safe-area-inset-bottom));
  transform: translateX(-50%); margin: 0; padding: 9px 16px; border-radius: 999px;
  background: var(--colorNeutralBackgroundInverted); color: var(--colorNeutralForegroundInverted);
  box-shadow: var(--shadow16); font-size: 13px; max-width: calc(100vw - 32px); text-align: center;
}
.toast-enter-active, .toast-leave-active { transition: opacity .16s ease, transform .16s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 6px); }
.tab-fade-enter-active, .tab-fade-leave-active { transition: opacity .12s ease; }
.tab-fade-enter-from, .tab-fade-leave-to { opacity: 0; }

@media (max-width: 1080px) {
  .doc-grid { grid-template-columns: minmax(0, 1fr); }
  .doc-side { position: static; max-height: none; overflow: visible; }
  .doc-toc-card { display: none; }
}
@media (max-width: 680px) {
  .doc-header { padding: 18px; }
  .doc-content { padding: 18px; }
  .doc-toolbar { width: 100%; margin-left: 0; }
  .doc-toolbar > * { flex: 1 1 auto; }
  .level-comparison { grid-template-columns: minmax(0, 1fr); }
  .detail-footer { align-items: flex-start; flex-direction: column; }
  .risk-actions { flex-wrap: wrap; }
  .compare-controls { grid-template-columns: minmax(0, 1fr); }
  .compare-controls > svg { display: none; }
}
</style>
