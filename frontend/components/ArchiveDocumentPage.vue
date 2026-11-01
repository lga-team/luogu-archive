<script setup lang="ts">
import { ArrowLeftRight, Check, ChevronDown, Clock3, Copy, ExternalLink, FileText, RefreshCw } from 'lucide-vue-next'
import { buildLineDiff, type DiffRow } from '~/utils/lineDiff'

const props = defineProps<{ contentType: 'article' | 'paste'; contentId: string }>()
const {
  label, data, pending, error, refresh, versions, selected, title,
  historyPending, historyError, refreshHistory, selectVersion, showLatest,
} = useArchiveDocument(props.contentType, props.contentId)
const { format, smart } = useTime()

const updatedAt = computed(() => props.contentType === 'article' ? data.value?.last_crawled_at : data.value?.crawled_at)
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)
const historyOpen = ref(true)
const copyState = ref<'idle' | 'success' | 'failed'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined
let copyRequest = 0
let media: MediaQueryList | undefined

function updateHistoryLayout() { historyOpen.value = !media?.matches }
onMounted(() => {
  media = window.matchMedia('(max-width: 900px)')
  updateHistoryLayout()
  media.addEventListener('change', updateHistoryLayout)
})
watch(() => selected.value?.id, () => {
  copyRequest++
  clearTimeout(copyTimer)
  copyState.value = 'idle'
})
onBeforeUnmount(() => {
  copyRequest++
  clearTimeout(copyTimer)
  media?.removeEventListener('change', updateHistoryLayout)
})

const compareOpen = ref(false)
const compareOnlyChanges = ref(true)
const compareLeftId = ref('')
const compareRightId = ref('')
const versionKey = (version: { id: number | null; is_current?: boolean }) => version.id === null || version.is_current ? 'current' : String(version.id)
const versionOptions = computed(() => versions.value.map(version => ({
  value: versionKey(version),
  label: `版本 ${version.number} · ${format(version.crawled_at, 'YYYY/MM/DD HH:mm')}${version.is_current ? ' · 最新' : ''}`,
})))
const compareLeft = computed(() => versions.value.find(version => versionKey(version) === compareLeftId.value) || null)
const compareRight = computed(() => versions.value.find(version => versionKey(version) === compareRightId.value) || null)
const compareRows = computed<DiffRow[]>(() => buildLineDiff(compareLeft.value?.content_md || '', compareRight.value?.content_md || ''))
const compareChanges = computed(() => compareRows.value.filter(row => row.kind !== 'same').length)
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
const compareAdds = computed(() => compareRows.value.filter(row => row.kind === 'add' || row.kind === 'change').length)
const compareRemoves = computed(() => compareRows.value.filter(row => row.kind === 'remove' || row.kind === 'change').length)

function openCompare() {
  const list = versions.value
  if (list.length < 2) return
  const selectedKey = selected.value ? versionKey(selected.value) : versionKey(list[0])
  const right = list.find(version => versionKey(version) === selectedKey) || list[0]
  const left = list.find(version => versionKey(version) !== versionKey(right)) || list[1]
  compareRightId.value = versionKey(right)
  compareLeftId.value = versionKey(left)
  compareOpen.value = true
}
function compareWith(version: typeof versions.value[number]) {
  const current = versions.value.find(item => item.is_current) || versions.value[0]
  if (version.is_current) {
    const previous = versions.value.find(item => !item.is_current)
    compareLeftId.value = previous ? versionKey(previous) : versionKey(version)
    compareRightId.value = versionKey(version)
  } else {
    compareLeftId.value = versionKey(version)
    compareRightId.value = versionKey(current)
  }
  compareOpen.value = true
}

async function copyOriginal() {
  if (!selected.value) return
  const request = ++copyRequest
  clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(selected.value.content_md)
    if (request !== copyRequest) return
    copyState.value = 'success'
  } catch {
    if (request !== copyRequest) return
    copyState.value = 'failed'
  }
  copyTimer = setTimeout(() => { copyState.value = 'idle' }, 1600)
}
</script>

<template>
  <div class="page doc-page">
    <header class="card doc-header">
      <div class="doc-header__top">
        <div class="cluster">
          <span class="tag tag--brand">{{ label }}</span>
          <span v-if="data?.version_count" class="tag">共 {{ data.version_count }} 个版本</span>
          <span v-if="data?.source_time" class="meta-item muted">{{ format(data.source_time, 'YYYY-MM-DD HH:mm:ss') }}</span>
        </div>
        <div class="doc-toolbar">
          <FButton appearance="outline" :href="`https://www.luogu.com.cn/${contentType}/${contentId}`" target="_blank">
            <template #start><ExternalLink :size="14" aria-hidden="true" /></template>
            查看原文
          </FButton>
          <FButton appearance="outline" :disabled="!selected" @click="copyOriginal">
            <template #start><component :is="copyState === 'success' ? Check : Copy" :size="14" aria-hidden="true" /></template>
            {{ copyState === 'success' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制原文' }}
          </FButton>
          <FButton appearance="outline" :disabled="versions.length < 2" @click="openCompare">
            <template #start><ArrowLeftRight :size="14" aria-hidden="true" /></template>
            版本对比
          </FButton>
          <SaveButton :content-type="contentType" :content-id="contentId">
            <template #default="{ state, message, save }">
              <ArchiveUpdateButton :state="state" :message="message" @update="save" />
            </template>
          </SaveButton>
        </div>
      </div>

      <div class="doc-header__main">
        <h1 class="doc-title">{{ title }}</h1>
        <div class="doc-meta">
          <div v-if="data?.author" class="doc-author">
            <NuxtLink :to="`/user/${data.author.uid}`" class="doc-author__avatar" :aria-label="`${data.author.name} 的主页`">
              <LuoguAvatar :user="data.author" :size="34" />
            </NuxtLink>
            <div class="stack stack--xs">
              <LuoguUserName :user="data.author" show-badge />
              <span class="muted" style="font-size: 11px">作者</span>
            </div>
          </div>
          <span v-else class="muted" style="font-size: 13px">{{ pending ? '正在读取作者…' : '作者未收录' }}</span>

          <span class="meta-item muted">
            <Clock3 :size="14" aria-hidden="true" />
            上次更新
            <time v-if="updatedAt" :datetime="updatedAt" :title="format(updatedAt, 'YYYY-MM-DD HH:mm:ss')">{{ smart(updatedAt) }}</time>
            <span v-else>—</span>
          </span>
        </div>
      </div>
      <span class="sr-only" role="status">{{ copyState === 'failed' ? '无法复制，请检查浏览器剪贴板权限。' : copyState === 'success' ? '已复制当前版本的原始 Markdown。' : '' }}</span>
    </header>

    <div class="doc-grid">
      <main class="card doc-content" aria-label="文档正文">
        <LoadingPanel v-if="pending" variant="detail" :title="'正在读取' + label + '归档'" />
        <div v-else-if="error" class="doc-state" role="alert">
          <div class="empty-state" style="padding: 24px 8px">
            <div class="empty-state__icon"><FileText :size="24" aria-hidden="true" /></div>
            <div class="empty-state__title">{{ (error as any)?.data?.message || '加载失败' }}</div>
            <p class="empty-state__body">
              {{ error.statusCode === 404 ? `${label}未被收录或无法访问，请查看提示后稍后重试。` : '请稍后重试。' }}
            </p>
            <FButton appearance="outline" size="small" @click="refresh()">
              <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重新读取
            </FButton>
          </div>
        </div>
        <template v-else-if="data">
          <ArticleAdminNote v-if="contentType === 'article' && data.admin_note" :note="data.admin_note" />
          <LoadingPanel v-if="!selected && historyPending" variant="list" :rows="4" compact title="正在读取所选版本" />
          <div v-else-if="!selected" class="doc-state" role="alert">
            <h2>无法读取这个版本</h2>
            <p class="muted">{{ historyError ? '历史版本加载失败，请重试。' : '该版本不存在或不属于这份文档。' }}</p>
            <FButton appearance="outline" size="small" @click="showLatest">查看最新版</FButton>
          </div>
          <template v-else>
            <div ref="contentRef" class="doc-markdown-wrap">
              <MarkdownBody :source="selected.content_md" class="markdown-body doc-markdown" />
            </div>
            <p v-if="!selected.content_md" class="doc-state">此版本正文为空</p>
          </template>
        </template>
      </main>

      <aside class="doc-side">
        <details class="card doc-versions" :open="historyOpen" @toggle="historyOpen = ($event.target as HTMLDetailsElement).open">
          <summary>
            <Clock3 :size="17" aria-hidden="true" />
            <span>历史版本</span>
            <ChevronDown class="doc-versions__chevron" :size="16" aria-hidden="true" />
          </summary>
          <div class="doc-versions__body">
            <LoadingPanel v-if="pending && !data" variant="list" :rows="3" compact title="正在加载版本" />
            <div v-else-if="historyError" class="doc-state" role="alert">
              <p>历史版本加载失败</p>
              <FButton appearance="subtle" size="small" @click="refreshHistory()">
                <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重试
              </FButton>
            </div>
            <ol v-else-if="versions.length" class="doc-timeline">
              <li v-for="version in versions" :key="versionKey(version)" class="doc-version-row">
                <button
                  type="button"
                  class="doc-version"
                  :class="{ 'is-selected': selected === version }"
                  :aria-current="selected === version ? 'true' : undefined"
                  @click="selectVersion(version)"
                >
                  <span class="doc-version__dot" aria-hidden="true" />
                  <span class="doc-version__heading">
                    版本 {{ version.number }}
                    <span v-if="version.is_current" class="tag tag--brand" style="font-size: 10px">最新</span>
                  </span>
                  <span class="doc-version__title">{{ version.title || (contentType === 'paste' ? `剪贴板 ${contentId}` : '无标题') }}</span>
                  <time :datetime="version.crawled_at">{{ format(version.crawled_at, 'YYYY/M/D HH:mm') }}</time>
                </button>
                <button
                  type="button"
                  class="doc-version-compare"
                  title="对比此版本"
                  aria-label="对比此版本"
                  @click.stop="compareWith(version)"
                >
                  <ArrowLeftRight :size="13" aria-hidden="true" />
                </button>
              </li>
            </ol>
            <p v-else class="doc-state">暂无历史版本</p>
          </div>
        </details>

        <div class="card doc-toc-card">
          <ArchiveDocumentToc :content="contentRef" />
        </div>
      </aside>
    </div>

    <FDialog v-model:open="compareOpen" title="版本对比" size="large">
      <div class="compare-panel">
        <div class="compare-controls">
          <FSelect v-model="compareLeftId" :options="versionOptions" aria-label="左侧版本" />
          <ArrowLeftRight :size="16" class="muted" aria-hidden="true" />
          <FSelect v-model="compareRightId" :options="versionOptions" aria-label="右侧版本" />
        </div>
        <div class="compare-summary">
          <span class="tag tag--success">+{{ compareAdds }}</span>
          <span class="tag tag--danger">-{{ compareRemoves }}</span>
          <span class="muted" style="font-size: 12px">共 {{ compareChanges }} 行变更</span>
          <FSwitch v-model="compareOnlyChanges" label="仅显示变更" style="margin-left: auto" />
        </div>
        <div v-if="compareLeft && compareRight" class="compare-view">
          <div v-for="(row, index) in visibleCompareRows" :key="index" class="compare-row" :class="row.kind">
            <span class="compare-no">{{ row.leftNo || '' }}</span>
            <code class="compare-code">{{ row.left }}</code>
            <span class="compare-no">{{ row.rightNo || '' }}</span>
            <code class="compare-code">{{ row.right }}</code>
          </div>
        </div>
        <div v-else class="notice">请选择两个版本进行对比。</div>
      </div>
      <template #actions>
        <FButton appearance="outline" @click="compareOpen = false">关闭</FButton>
      </template>
    </FDialog>
  </div>
</template>

<style scoped>
.doc-header { padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; }
.doc-header__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 18px; flex-wrap: wrap; }
.doc-header__main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.doc-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
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
.doc-versions summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none; font-weight: 600; font-size: 14px; }
.doc-versions summary::-webkit-details-marker { display: none; }
.doc-versions__chevron { margin-left: auto; color: var(--colorNeutralForeground3); transition: transform var(--app-transition); }
.doc-versions[open] .doc-versions__chevron { transform: rotate(180deg); }
.doc-versions__body { padding-top: 14px; }
.doc-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.doc-timeline li { position: relative; }
.doc-version-row { display: flex; align-items: stretch; gap: 2px; border-radius: var(--borderRadiusMedium); }
.doc-version-row:hover { background: var(--colorNeutralBackground1Hover); }
.doc-version { flex: 1 1 auto; min-width: 0; }
.doc-version-compare { width: 26px; flex-shrink: 0; display: grid; place-items: center; border: 0; border-radius: var(--borderRadiusMedium); background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); color: var(--colorNeutralForeground2); cursor: pointer; opacity: 1; transition: opacity var(--durationFaster) var(--curveEasyEase), background var(--durationFaster) var(--curveEasyEase), color var(--durationFaster) var(--curveEasyEase); }
.doc-version-row:hover .doc-version-compare, .doc-version-compare:focus-visible { opacity: 1; background: var(--colorNeutralBackground1Hover); }
.doc-version-compare:hover { background: var(--colorNeutralBackground1Selected); color: var(--colorBrandForeground1); }
.doc-version {
  position: relative; display: flex; flex-direction: column; gap: 3px; width: 100%;
  padding: 9px 10px 9px 24px; border: 0; border-radius: var(--borderRadiusMedium);
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
.doc-version__title { overflow-wrap: anywhere; }
.doc-version time { color: var(--colorNeutralForeground3); font-size: 11px; font-variant-numeric: tabular-nums; }
.doc-toc-card { padding: 0; overflow: hidden; }
.doc-toc-card :deep(.document-toc-nav) { border: 0; box-shadow: none; }
.doc-state { color: var(--colorNeutralForeground3); font-size: 14px; line-height: 1.7; padding: 12px 0; margin: 0; }
.doc-state h2 { font-size: 18px; color: var(--colorNeutralForeground1); margin: 0 0 8px; }

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
  .doc-version-compare { opacity: 1; }
}

/* Version comparison */
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
@media (max-width: 680px) {
  .compare-controls { grid-template-columns: minmax(0, 1fr); }
  .compare-controls > svg { display: none; }
}
</style>
