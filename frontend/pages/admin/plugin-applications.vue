<script setup lang="ts">
import { GitPullRequest } from 'lucide-vue-next'
import type { PluginSnapshot, PluginTag } from '~/types/plugin'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const { runtimeMode } = usePluginLabels()

const rows = ref<any[]>([])
const tags = ref<PluginTag[]>([])
const selected = ref<any>(null)
const snapshot = ref<PluginSnapshot | null>(null)
const status = ref('pending')
const applicationType = ref('')
const loading = ref(false)
const errorText = ref('')

const statusOptions = [
  { value: 'pending', label: '待处理' }, { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' }, { value: 'cancelled', label: '已撤销' }, { value: 'all', label: '全部' },
]
const typeOptions = [
  { value: '', label: '全部类型' }, { value: 'publish', label: '首次发布' },
  { value: 'update', label: '版本更新' }, { value: 'recommend', label: '推荐申请' }, { value: 'delete', label: '删除申请' },
]

const currentCodePreview = computed(() => ({ code: selected.value?.current?.code || '', truncated: selected.value?.current?.code_truncated ?? false }))
const submittedCodePreview = computed(() => ({ code: snapshot.value?.code || '', truncated: snapshot.value?.code_truncated ?? false }))
const submittedTags = computed(() => {
  const selectedIds = new Set(snapshot.value?.tag_ids || [])
  return tags.value.filter(tag => selectedIds.has(tag.id))
})
const adminAnalysis = computed({
  get: () => snapshot.value?.admin_request_analysis || '',
  set: (value: string) => { if (snapshot.value) snapshot.value.admin_request_analysis = value || null },
})
const adminLevelEnabled = computed({
  get: () => snapshot.value?.admin_request_level !== null && snapshot.value?.admin_request_level !== undefined,
  set: (enabled: boolean) => {
    if (!snapshot.value) return
    snapshot.value.admin_request_level = enabled ? snapshot.value.user_request_level : null
  },
})
const typeNames: Record<string, string> = { publish: '首次发布', update: '版本更新', recommend: '推荐申请', delete: '删除申请' }
const statusNames: Record<string, string> = { pending: '待处理', approved: '已通过', rejected: '已拒绝', cancelled: '已撤销' }
const statusClass = (value: string) => value === 'approved' ? 'tag--success' : value === 'rejected' ? 'tag--danger' : value === 'pending' ? 'tag--warn' : 'tag'

async function loadList() {
  rows.value = await api<any[]>('/admin/plugin-applications', { query: { status: status.value, ...(applicationType.value ? { application_type: applicationType.value } : {}) } })
}
async function openApplication(id: number) {
  loading.value = true
  errorText.value = ''
  try {
    const data = await api<any>(`/admin/plugin-applications/${id}`)
    snapshot.value = Object.keys(data.snapshot || {}).length ? structuredClone(data.snapshot) : null
    selected.value = data
  } catch (error: any) {
    errorText.value = error?.data?.message || '申请详情加载失败'
  } finally {
    loading.value = false
  }
}
async function review(approved: boolean) {
  if (!selected.value) return
  const rejectionReason = approved ? null : prompt('请填写拒绝原因：')
  if (!approved && !rejectionReason) return
  if (approved && !confirm('确认按当前页面中的内容通过这条申请吗？')) return
  try {
    await api(`/admin/plugin-applications/${selected.value.id}/review`, {
      method: 'POST',
      body: {
        approved,
        rejection_reason: rejectionReason,
        admin_request_level: snapshot.value?.admin_request_level ?? null,
        admin_request_analysis: snapshot.value?.admin_request_analysis || null,
      },
    })
    selected.value = null
    snapshot.value = null
    await loadList()
  } catch (error: any) {
    errorText.value = error?.data?.message || '审核失败'
  }
}
async function downloadSubmittedCode() {
  if (!snapshot.value || !selected.value) return
  const blob = await api<Blob>(`/admin/plugin-applications/${selected.value.id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = (snapshot.value.download_filename || 'plugin.user.js').split(/[\\/]/).pop() || 'plugin.user.js'
  anchor.click()
  URL.revokeObjectURL(url)
}
onMounted(async () => {
  if (!admin.isLoggedIn) return navigateTo('/admin/login')
  rows.value = await api<any[]>('/admin/plugin-applications', { query: { status: status.value } })
  tags.value = await api<PluginTag[]>('/admin/plugin-tags')
})
watch([status, applicationType], () => { void loadList() })
</script>

<template>
  <div class="page">
    <PageHeader title="插件申请" description="审核插件首次发布、版本更新、推荐与删除申请。" eyebrow="Applications">
      <template #icon><GitPullRequest :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FSelect v-model="status" :options="statusOptions" size="small" style="width:135px" aria-label="申请状态" />
        <FSelect v-model="applicationType" :options="typeOptions" size="small" style="width:145px" aria-label="申请类型" />
      </template>
    </PageHeader>

    <div class="workspace">
      <aside class="card application-list">
        <div class="list-scroll">
          <button v-for="row in rows" :key="row.id" type="button" class="application-item" :class="{ 'is-active': selected?.id === row.id }" @click="openApplication(row.id)">
            <div class="cluster" style="justify-content:space-between">
              <strong>#{{ row.id }} · {{ typeNames[row.application_type] }}</strong>
              <span class="tag" :class="statusClass(row.status)">{{ statusNames[row.status] || row.status }}</span>
            </div>
            <span class="muted" style="font-size:11px">文章 {{ row.article_id }}<template v-if="row.version"> · v{{ row.version }}</template></span>
          </button>
          <EmptyState v-if="!rows.length" title="暂无申请" compact />
        </div>
      </aside>

      <main class="card review-pane">
        <LoadingPanel v-if="loading" title="正在加载申请详情" compact />
        <EmptyState v-else-if="!selected" title="选择一条申请" description="从左侧列表中选择要审核的申请。" />
        <div v-else class="card__body stack stack--lg">
          <div class="section-head">
            <div class="stack stack--xs">
              <h2 class="section-title" style="font-size:18px">#{{ selected.id }} {{ typeNames[selected.application_type] }}</h2>
              <span class="muted" style="font-size:12px">申请人：{{ selected.applicant?.display_name || '-' }} · 洛谷 UID {{ selected.applicant?.luogu_uid || '-' }}</span>
            </div>
            <FButton appearance="outline" size="small" :href="'/article/' + selected.article_id" target="_blank">查看原文章</FButton>
          </div>

          <div v-if="selected.reason" class="notice notice--warn">申请理由：{{ selected.reason }}</div>

          <section v-if="snapshot" class="stack">
            <div class="section-head"><h3 class="section-title" style="font-size:15px">用户提交内容</h3><span class="tag">只读</span></div>
            <dl class="review-dl">
              <div class="wide"><dt>介绍</dt><dd>{{ snapshot.summary || '留空，由系统从文章正文生成' }}</dd></div>
              <div><dt>代码版本</dt><dd>{{ snapshot.version }}</dd></div>
              <div><dt>下载文件名</dt><dd>{{ snapshot.download_filename }}</dd></div>
              <div><dt>运行方式</dt><dd>{{ runtimeMode(snapshot.runtime_mode) }}</dd></div>
              <div><dt>兼容设备</dt><dd>{{ [snapshot.supports_desktop ? '桌面端' : '', snapshot.supports_mobile ? '移动端' : ''].filter(Boolean).join('、') || '-' }}</dd></div>
              <div><dt>最后验证</dt><dd>{{ snapshot.last_verified_on }}</dd></div>
              <div class="wide"><dt>功能标签</dt><dd>{{ submittedTags.map(tag => tag.name).join('、') || '未选择' }}</dd></div>
            </dl>
          </section>

          <section v-if="snapshot && selected.current" class="stack">
            <div class="section-head">
              <h3 class="section-title" style="font-size:15px">当前版与申请版</h3>
              <FButton appearance="outline" size="small" @click="downloadSubmittedCode">下载申请版完整代码</FButton>
            </div>
            <div class="version-diff"><span class="muted">版本</span><del>{{ selected.current.version }}</del><ins>{{ snapshot.version }}</ins></div>
            <details class="code-details">
              <summary>查看代码差异原文</summary>
              <div class="code-diff">
                <div><strong>当前正式版</strong><p v-if="currentCodePreview.truncated" class="field-help">预览已截断，完整代码未被修改。</p><pre>{{ currentCodePreview.code }}</pre></div>
                <div><strong>本次申请版</strong><p v-if="submittedCodePreview.truncated" class="field-help">预览已截断，完整代码未被修改。</p><pre>{{ submittedCodePreview.code }}</pre></div>
              </div>
            </details>
          </section>

          <section v-else-if="snapshot" class="stack">
            <div class="section-head">
              <h3 class="section-title" style="font-size:15px">代码预览</h3>
              <FButton appearance="outline" size="small" @click="downloadSubmittedCode">下载完整代码</FButton>
            </div>
            <p v-if="submittedCodePreview.truncated" class="field-help">预览最多显示 1000 行且不超过 50 KiB，完整代码未被修改。</p>
            <pre class="code-block">{{ submittedCodePreview.code }}</pre>
          </section>

          <template v-if="snapshot">
            <section class="stack">
              <div class="section-head"><h3 class="section-title" style="font-size:15px">用户请求说明</h3><PluginRequestLevelBadge :level="snapshot.user_request_level" compact /></div>
              <MarkdownBody :source="snapshot?.user_request_analysis" class="markdown-body" v-if="snapshot" />
            </section>
            <section class="stack">
              <h3 class="section-title" style="font-size:15px">管理员评估</h3>
              <FSwitch v-model="adminLevelEnabled" label="调整公开显示的请求等级" />
              <div v-if="adminLevelEnabled" class="level-editor">
                <div class="cluster" style="justify-content:space-between">
                  <span class="muted" style="font-size:12px">管理员显示等级</span>
                  <PluginRequestLevelBadge :level="snapshot.admin_request_level ?? snapshot.user_request_level" compact />
                </div>
                <FSlider :model-value="snapshot.admin_request_level ?? 0" @update:model-value="snapshot.admin_request_level = $event" :min="0" :max="3" :step="1" aria-label="管理员显示等级" />
              </div>
              <PluginMarkdownEditor v-model="adminAnalysis" label="管理组请求分析" :maxlength="20000" placeholder="管理组人工审核结论（可留空）" />
            </section>
          </template>
          <div v-else class="notice notice--warn">该申请不包含代码快照，请核对上方理由后处理。</div>

          <div v-if="errorText" class="notice notice--warn" role="alert">{{ errorText }}</div>

          <div v-if="selected.status === 'pending'" class="cluster" style="justify-content:flex-end;padding-top:12px;border-top:1px solid var(--colorNeutralStroke2)">
            <FButton appearance="subtle" @click="review(false)">拒绝</FButton>
            <FButton appearance="primary" @click="review(true)">通过</FButton>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.workspace { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 16px; align-items: start; }
.application-list { overflow: hidden; }
.list-scroll { display: flex; flex-direction: column; max-height: calc(100dvh - 220px); overflow-y: auto; }
.application-item {
  display: flex; flex-direction: column; gap: 4px; width: 100%;
  padding: 12px 14px; border: 0; border-bottom: 1px solid var(--colorNeutralStroke2);
  background: transparent; color: var(--colorNeutralForeground1); text-align: left; cursor: pointer; font: inherit;
}
.application-item:hover { background: var(--colorNeutralBackground1Hover); }
.application-item.is-active { background: var(--colorBrandBackground2); box-shadow: inset 3px 0 var(--colorBrandBackground); }
.review-pane { min-width: 0; }
.review-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin: 0; font-size: 12px; }
.review-dl .wide { grid-column: 1 / -1; }
.review-dl dt { color: var(--colorNeutralForeground3); }
.review-dl dd { margin: 2px 0 0; overflow-wrap: anywhere; }
.version-diff { display: grid; grid-template-columns: 56px 1fr 1fr; gap: 10px; padding: 7px 0; font-size: 13px; }
.version-diff ins { color: var(--colorPaletteGreenForeground1, #0e700e); text-decoration: none; }
.code-details summary { cursor: pointer; font-size: 13px; font-weight: 600; }
.code-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.code-diff > div { min-width: 0; }
.code-diff strong { display: block; margin-bottom: 5px; font-size: 12px; }
.code-diff pre, .code-block {
  max-height: 300px; overflow: auto; margin: 0; padding: 10px;
  border-radius: var(--borderRadiusMedium); border: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground2); font-family: var(--fontFamilyMonospace); font-size: 11.5px; line-height: 1.55;
}
.code-block { max-height: 380px; font-size: 12px; white-space: pre; }
.level-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge); }
@media (max-width: 980px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .list-scroll { max-height: 300px; }
  .code-diff, .review-dl { grid-template-columns: minmax(0, 1fr); }
  .review-dl .wide { grid-column: auto; }
}
</style>
