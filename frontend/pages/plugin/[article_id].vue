<script setup lang="ts">
import { BadgeCheck, ChevronLeft, Code2, Download, ExternalLink, Flag, GitPullRequest, Sparkles } from 'lucide-vue-next'
import type { PluginDetail, PluginSnapshot, PluginVersion } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'

const route = useRoute()
const articleId = String(route.params.article_id)
const auth = useAuthStore()
const api = useApi()
const { format } = useTime()
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
useCopyCode(articleRef)

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
  if (versionId === 'pending') {
    showPending.value = true
    selectedVersion.value = detail.value.current
    return
  }
  selectedVersion.value = await api<PluginVersion>(`/plugins/${articleId}/versions/${versionId}`)
  showPending.value = false
}

function openInstall(nextAction: 'copy' | 'download') {
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

function showToast(message: string) {
  toast.value = message
  setTimeout(() => { toast.value = '' }, 1800)
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

onMounted(async () => {
  if (!auth.initialized) await auth.tryRefresh()
  await load()
})

useHead(() => ({ title: `${displayName.value} - 插件广场` }))
</script>

<template>
  <LoadingPanel v-if="loading" variant="detail" title="正在加载插件" />

  <div v-else-if="errorText" class="page page--medium">
    <EmptyState title="插件不可用" :description="errorText">
      <template #actions><FButton appearance="outline" @click="navigateTo('/plugin')">返回插件广场</FButton></template>
    </EmptyState>
  </div>

  <div v-else-if="detail && article" class="page page--medium plugin-detail">
    <PageHeader :title="displayName" :description="`文章编号 ${articleId} · ${displayVersion ? runtimeMode(displayVersion.runtime_mode) : '未知运行方式'}`" eyebrow="Plugin">
      <template #actions>
        <FButton appearance="outline" @click="navigateTo('/plugin')">
          <template #start><ChevronLeft :size="16" aria-hidden="true" /></template>插件广场
        </FButton>
        <FButton appearance="outline" :href="`https://www.luogu.com.cn/article/${articleId}`" target="_blank">
          <template #start><ExternalLink :size="15" aria-hidden="true" /></template>洛谷原文
        </FButton>
      </template>
      <template #meta>
        <span v-if="safeDetail.is_official" class="tag tag--brand"><BadgeCheck :size="12" aria-hidden="true" />官方</span>
        <span v-if="safeDetail.is_recommended" class="tag tag--warn"><Sparkles :size="12" aria-hidden="true" />推荐</span>
        <div v-if="article.author" class="cluster" style="gap: 7px">
          <LuoguAvatar :user="article.author" :size="24" />
          <LuoguUserName :user="article.author" show-badge />
        </div>
        <span class="meta-item">更新于 {{ safeDetail.updated_at ? format(safeDetail.updated_at) : '未知' }}</span>
        <span v-if="safeDetail.total_usage !== undefined" class="meta-item">使用次数 {{ safeDetail.total_usage }}</span>
        <PluginRequestLevelBadge v-if="displayVersion" :level="displayVersion.final_request_level" compact />
        <span v-for="tag in displayTags" :key="tag.id" class="tag">{{ tag.name }}</span>
      </template>
    </PageHeader>

    <div v-if="safeDetail.can_claim" class="notice notice--brand">
      <GitPullRequest :size="18" aria-hidden="true" />
      <div style="flex:1 1 auto;min-width:0">
        <strong>此插件可能为你所有</strong>
        <p class="field-help" style="margin-top:2px">原文章作者与你绑定的洛谷账号一致，认领后可管理和更新此插件。</p>
        <p v-if="claimError" class="field-error">{{ claimError }}</p>
      </div>
      <FButton appearance="primary" size="small" :loading="claiming" @click="claimPlugin">{{ claiming ? '认领中…' : '认领' }}</FButton>
    </div>

    <div v-if="safeDetail.pending_application" class="notice notice--warn">
      <GitPullRequest :size="18" aria-hidden="true" />
      <div style="flex:1 1 auto;min-width:0">
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

    <FTabList v-model="activeTab" :tabs="tabs" aria-label="插件内容" />

    <Transition name="tab-fade" mode="out-in">
      <section v-if="activeTab === 'article'" key="article" class="card">
        <div class="card__body" style="padding: clamp(18px,3vw,30px)">
          <ArticleAdminNote :note="article.admin_note" />
          <div ref="articleRef">
            <MarkdownBody :source="article.content_md" class="markdown-body" />
          </div>
        </div>
      </section>

      <section v-else-if="activeTab === 'code' && displayVersion" key="code" class="card">
        <div class="card__header" style="flex-wrap: wrap">
          <div class="stack stack--xs" style="min-width: 200px">
            <h2 class="card__title" style="display:flex;align-items:center;gap:7px"><Code2 :size="17" aria-hidden="true" />代码预览</h2>
            <span class="card__description">{{ codePreview.code.split('\n').length }} 行 · {{ Math.ceil((displayVersion.code_bytes || 0) / 1024) }} KiB</span>
          </div>
          <div class="cluster" style="flex-wrap: wrap">
            <FSelect
              :model-value="selectedVersionValue"
              :options="versionOptions"
              size="small"
              aria-label="代码版本"
              style="width: 200px"
              @update:model-value="selectVersion"
            />
            <FButton appearance="primary" size="small" :disabled="copyDisabled" :title="copyDisabled ? '完整代码超过 100 KiB，仅支持下载' : '复制代码'" @click="openInstall('copy')">
              复制代码
            </FButton>
            <FButton appearance="outline" size="small" @click="openInstall('download')">
              <template #start><Download :size="14" aria-hidden="true" /></template>下载文件
            </FButton>
          </div>
        </div>
        <div class="card__body stack">
          <div v-if="codePreview.truncated" class="notice notice--warn">
            <strong>代码较长，已截断显示</strong>
            <span>页面最多展示前 1000 行且不超过 50 KiB，完整代码未被修改。</span>
          </div>
          <div v-if="copyDisabled" class="notice notice--warn">
            <strong>复制已禁用</strong>
            <span>完整代码超过 100 KiB，请下载文件。</span>
          </div>
          <pre class="code-view"><code>{{ codePreview.code }}</code></pre>
          <dl class="compat-grid">
            <div><dt>运行方式</dt><dd>{{ runtimeMode(displayVersion.runtime_mode) }}</dd></div>
            <div><dt>兼容设备</dt><dd>{{ [displayVersion.supports_desktop ? '桌面端' : '', displayVersion.supports_mobile ? '移动端' : ''].filter(Boolean).join('、') || '—' }}</dd></div>
            <div><dt>下载次数</dt><dd>{{ displayVersion.download_count ?? 0 }}</dd></div>
            <div><dt>最后验证</dt><dd>{{ displayVersion.last_verified_on || '—' }}</dd></div>
            <div class="wide"><dt>SHA-256</dt><dd><code class="code-inline">{{ displayVersion.code_sha256 }}</code></dd></div>
          </dl>
        </div>
      </section>

      <section v-else-if="activeTab === 'analysis' && displayVersion" key="analysis" class="card">
        <div class="card__body stack stack--lg">
          <div class="level-comparison" :class="{ single: displayVersion.admin_request_level === null }">
            <div><span class="muted">用户提交等级</span><PluginRequestLevelBadge :level="displayVersion.user_request_level" /></div>
            <div v-if="displayVersion.admin_request_level !== null">
              <span class="muted">管理员更改等级</span>
              <PluginRequestLevelBadge :level="displayVersion.admin_request_level" />
            </div>
          </div>
          <section class="stack">
            <h2 class="section-title">上传者请求分析</h2>
            <MarkdownBody :source="displayVersion.user_request_analysis" class="markdown-body" />
          </section>
          <section v-if="displayVersion.admin_request_analysis" class="stack" style="padding-top:16px;border-top:1px solid var(--colorNeutralStroke2)">
            <h2 class="section-title">管理组请求分析</h2>
            <MarkdownBody :source="displayVersion.admin_request_analysis" class="markdown-body" />
          </section>
        </div>
      </section>
    </Transition>

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
  </div>
</template>

<style scoped>
.plugin-detail { display: flex; flex-direction: column; gap: 16px; }
.code-view {
  margin: 0; max-height: 620px; overflow: auto; padding: 16px;
  border-radius: var(--borderRadiusLarge); border: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground2);
  font-family: var(--fontFamilyMonospace); font-size: 12.5px; line-height: 1.6; white-space: pre;
}
.compat-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 4px 0 0;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge); overflow: hidden;
}
.compat-grid > div { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--colorNeutralStroke2); border-bottom: 1px solid var(--colorNeutralStroke2); }
.compat-grid .wide { grid-column: 1 / -1; border-bottom: 0; }
.compat-grid > div:nth-child(4) { border-right: 0; }
.compat-grid dt { color: var(--colorNeutralForeground3); font-size: 11px; }
.compat-grid dd { margin: 3px 0 0; font-size: 13px; overflow-wrap: anywhere; }
.level-comparison {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge); overflow: hidden;
  background: var(--colorNeutralStroke2);
}
.level-comparison.single { grid-template-columns: minmax(0, 1fr); }
.level-comparison > div { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; background: var(--colorNeutralBackground1); }
.detail-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
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
@media (max-width: 680px) {
  .compat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .compat-grid > div:nth-child(2) { border-right: 0; }
  .level-comparison { grid-template-columns: minmax(0, 1fr); }
  .detail-footer { align-items: flex-start; flex-direction: column; }
}
</style>
