<script setup lang="ts">
import { Check, ChevronDown, Clock3, Copy, ExternalLink, RefreshCw } from 'lucide-vue-next'
import { Button } from './ui'

const props = defineProps<{ contentType: 'article' | 'paste'; contentId: string }>()
const {
  label, data, pending, error, refresh, versions, selected, title, html,
  historyPending, historyError, refreshHistory, selectVersion, showLatest,
} = useArchiveDocument(props.contentType, props.contentId)
const { format, smart } = useTime()
const updatedAt = computed(() => props.contentType === 'article'
  ? data.value?.last_crawled_at
  : data.value?.crawled_at,
)
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)
const historyOpen = ref(true)
const copyState = ref<'idle' | 'success' | 'failed'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined
let copyRequest = 0
let media: MediaQueryList | undefined

function updateHistoryLayout() { historyOpen.value = !media?.matches }
onMounted(() => {
  media = window.matchMedia('(max-width: 760px)')
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
  <div class="archive-ui document-page">
    <div class="document-layout">
    <header class="document-header">
      <div class="document-heading archive-card">
        <h1>{{ title }}</h1>
        <div class="document-metadata">
          <div class="document-author">
            <NuxtLink v-if="data?.author" :to="`/user/${data.author.uid}`" class="document-avatar-link" :aria-label="`${data.author.name} 的主页`">
              <img v-if="data.author.avatar" :src="data.author.avatar" alt="" class="document-avatar" loading="lazy">
              <span v-else class="document-avatar document-avatar-fallback">{{ (data.author.name || '?').charAt(0).toUpperCase() }}</span>
            </NuxtLink>
            <div class="document-author-name"><span class="document-meta-label">作者</span><LuoguUserName v-if="data?.author" :user="data.author" show-badge /><span v-else class="document-meta-value">{{ pending ? '正在读取' : '作者未收录' }}</span></div>
          </div>
          <div class="document-meta-block"><span class="document-meta-label">发布时间</span><time v-if="data?.source_time" :datetime="data.source_time">{{ format(data.source_time, 'YYYY-MM-DD HH:mm:ss') }}</time><span v-else>—</span></div>
        </div>
      </div>
      <div class="document-toolbar archive-card" aria-label="文档操作">
        <span class="document-updated">上次更新：<time v-if="updatedAt" :datetime="updatedAt" :title="format(updatedAt, 'YYYY-MM-DD HH:mm:ss')">{{ smart(updatedAt) }}</time><span v-else>—</span></span>
        <div class="document-actions">
        <Button variant="outline" size="sm" as-child><a :href="`https://www.luogu.com.cn/${contentType}/${contentId}`" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" aria-hidden="true" />查看原文</a></Button>
        <Button variant="outline" size="sm" class="document-copy" :disabled="!selected" @click="copyOriginal"><Check v-if="copyState === 'success'" :size="14" aria-hidden="true" /><Copy v-else :size="14" aria-hidden="true" />{{ copyState === 'success' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制原文' }}</Button>
        <SaveButton :content-type="contentType" :content-id="contentId"><template #default="{ state, message, save }"><ArchiveUpdateButton :state="state" :message="message" @update="save" /></template></SaveButton>
        </div>
        <span class="document-copy-status" role="status">{{ copyState === 'failed' ? '无法复制，请检查浏览器剪贴板权限。' : copyState === 'success' ? '已复制当前版本的原始 Markdown。' : '' }}</span>
      </div>
    </header>

      <aside class="document-versions" aria-label="历史版本">
        <details class="archive-card" :open="historyOpen" @toggle="historyOpen = ($event.target as HTMLDetailsElement).open">
          <summary><Clock3 :size="18" aria-hidden="true" /><h2>历史版本</h2><ChevronDown class="document-history-chevron" :size="16" aria-hidden="true" /></summary>
          <div class="document-history-body">
            <p v-if="pending || historyPending" class="document-state" role="status">正在加载版本…</p>
            <div v-else-if="historyError" class="document-state" role="alert"><p>历史版本加载失败</p><Button variant="ghost" size="sm" @click="refreshHistory"><RefreshCw :size="14" aria-hidden="true" />重试</Button></div>
            <ol v-else-if="versions.length" class="document-timeline">
              <li v-for="version in versions" :key="version.id ?? 'current'">
                <button type="button" class="document-version" :class="{ 'is-selected': selected === version }" :aria-current="selected === version ? 'true' : undefined" @click="selectVersion(version)">
                  <span class="document-version-dot" aria-hidden="true" />
                  <span class="document-version-heading">版本 {{ version.number }}<span v-if="version.is_current" class="document-current-label">最新</span></span>
                  <span class="document-version-title">{{ version.title || (contentType === 'paste' ? `剪贴板 ${contentId}` : '无标题') }}</span>
                  <time :datetime="version.crawled_at">{{ format(version.crawled_at, 'YYYY/M/D HH:mm:ss') }}</time>
                </button>
              </li>
            </ol>
            <p v-else class="document-state">暂无历史版本</p>
          </div>
        </details>
      </aside>

      <section class="document-content archive-card" aria-label="文档正文">
        <p v-if="pending" class="document-state" role="status">正在读取{{ label }}归档…</p>
        <div v-else-if="error" class="document-state document-error" role="alert">
          <h2>{{ error.data?.message || '加载失败' }}</h2>
          <p v-if="error.statusCode === 404">{{ label }}未被收录或无法访问，请查看提示后稍后重试。</p>
          <Button variant="outline" size="sm" @click="refresh"><RefreshCw :size="14" aria-hidden="true" />重新读取</Button>
        </div>
        <template v-else-if="data">
          <ArticleAdminNote v-if="contentType === 'article'" :note="data.admin_note" />
          <p v-if="!selected && historyPending" class="document-state" role="status">正在读取所选版本…</p>
          <div v-else-if="!selected" class="document-state document-error" role="alert"><h2>无法读取这个版本</h2><p>{{ historyError ? '历史版本加载失败，请重试。' : '该版本不存在或不属于这份文档。' }}</p><Button variant="outline" size="sm" @click="showLatest">查看最新版</Button></div>
          <template v-else>
            <p v-if="selected.content_md && !html" class="document-state" role="status">正在渲染正文…</p>
            <article v-else ref="contentRef" class="lg-content document-markdown" v-html="html" />
            <p v-if="!selected.content_md" class="document-state">此版本正文为空</p>
          </template>
        </template>
      </section>
      <aside class="document-toc" aria-label="文档目录">
        <ArchiveDocumentToc :content="contentRef" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* hidden 会形成额外滚动容器，clip 只裁剪横向溢出，不截断侧栏的吸顶链。 */
:global(html:has(.document-page)), :global(body:has(.document-page)) { overflow-x: clip; }
.document-page { container-type: inline-size; container-name: document-page; width: min(100%, 1180px); min-width: 0; margin: 0 auto; }
.document-layout { --document-side-width: 250px; display: grid; grid-template-columns: var(--document-side-width) minmax(0, 1fr) var(--document-side-width); grid-template-areas: 'versions header toc' 'versions content toc'; align-items: start; gap: 16px; min-width: 0; }
.document-header { grid-area: header; display: grid; gap: 16px; min-width: 0; }
.document-heading { display: block; padding: 22px 24px; min-width: 0; }
.document-heading h1 { font-size: 28px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; margin: 0 0 18px; }
.document-metadata { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; font-size: 13px; }
.document-author { display: flex; align-items: center; gap: 10px; margin-right: auto; min-width: 0; }
.document-avatar-link { flex: 0 0 36px; }
.document-avatar { display: block; width: 36px; height: 36px; object-fit: cover; border-radius: 50%; }
.document-avatar-fallback { display: grid; place-items: center; background: var(--hover); color: var(--text-muted); font-weight: 600; }
.document-author-name, .document-meta-block { display: grid; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.document-author-name :deep(.lg-user-wrap) { flex-wrap: wrap; }
.document-meta-label { color: var(--text-muted); font-size: 12px; }
.document-toolbar { display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 24px; }
.document-updated { margin-right: auto; color: var(--text-muted); font-size: 13px; overflow-wrap: anywhere; }
.document-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; min-width: 0; margin-left: auto; }
.document-toolbar a { text-decoration: none; }
.document-copy { min-width: 100px; }
.document-copy-status { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.document-versions { grid-area: versions; align-self: stretch; min-width: 0; }
.document-toc { grid-area: toc; align-self: stretch; min-width: 0; }
.document-toc > :deep(.document-toc-nav) { position: sticky; top: 18px; }
.document-versions > details { position: sticky; top: 18px; display: block; padding: 20px; min-width: 0; max-height: calc(100vh - 36px); overflow-y: auto; scrollbar-width: thin; }
.document-versions summary { display: flex; gap: 9px; align-items: center; cursor: pointer; list-style: none; }
.document-versions summary::-webkit-details-marker { display: none; }
.document-versions summary > svg { color: var(--text-muted); flex-shrink: 0; }
.document-versions summary > .document-history-chevron { margin-left: auto; color: var(--text-muted); transition: transform .15s; }
.document-versions details[open] .document-history-chevron { transform: rotate(180deg); }
.document-versions h2 { font-size: 15px; font-weight: 600; margin: 0; }
.document-history-body { padding-top: 20px; }
.document-timeline { list-style: none; margin: 0; padding: 0; }
.document-timeline li { position: relative; padding-left: 25px; }
.document-timeline li:not(:last-child)::before { content: ''; position: absolute; left: 7px; top: 12px; bottom: -12px; width: 2px; background: var(--border); }
.document-version { position: relative; display: grid; gap: 5px; width: 100%; padding: 0 0 20px; border: 0; background: transparent; color: var(--text-muted); text-align: left; font: inherit; font-size: 13px; line-height: 1.6; cursor: pointer; }
.document-timeline li:last-child .document-version { padding-bottom: 0; }
.document-version-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; color: var(--text); }
.document-current-label { font-size: 12px; color: var(--text-muted); }
.document-version-title { overflow-wrap: anywhere; }
.document-version time { font-size: 12px; font-variant-numeric: tabular-nums; }
.document-version-dot { position: absolute; left: -25px; top: 4px; width: 16px; height: 16px; border: 2px solid var(--text-muted); border-radius: 50%; background: var(--surface); }
.document-version.is-selected .document-version-dot { border-color: var(--lg-green); background: var(--surface); }
.document-version.is-selected .document-version-heading, .document-version:hover .document-version-title { color: var(--link); }
.document-version:focus-visible, .document-versions summary:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; border-radius: 2px; }
.document-content { grid-area: content; display: block; min-width: 0; min-height: 300px; padding: 22px 24px; overflow-wrap: anywhere; }
.document-markdown { font-size: 14px; line-height: 1.8; }
.document-markdown :deep(> :first-child) { margin-top: 0; }
.document-markdown :deep(> :last-child) { margin-bottom: 0; }
.document-markdown :deep(:is(h1,h2,h3,h4,h5,h6)) { scroll-margin-top: 24px; }
.document-state { color: var(--text-muted); font-size: 14px; line-height: 1.7; padding: 12px 0; margin: 0; }
.document-state h2 { font-size: 18px; color: var(--text); margin: 0 0 8px; }
.document-state p { margin: 0 0 10px; }
@container document-page (max-width: 1090px) {
  .document-layout { --document-side-width: 210px; grid-template-columns: var(--document-side-width) minmax(0, 1fr); grid-template-areas: 'versions header' 'versions content'; }
  .document-toc { display: none; }
  .document-versions > details { padding: 18px 16px; }
}
@container document-page (max-width: 760px) {
  .document-layout { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'header' 'versions' 'content'; }
  .document-heading { padding: 18px 16px; }
  .document-heading h1 { font-size: 24px; margin-bottom: 16px; }
  .document-metadata { gap: 16px 24px; }
  .document-author { flex-basis: 100%; }
  .document-toolbar { padding: 12px 16px; gap: 8px; }
  .document-actions { gap: 8px; }
  .document-versions > details { position: static; max-height: none; padding: 16px; }
  .document-history-body { max-height: 360px; overflow-y: auto; }
  .document-content { padding: 18px 16px; }
}
</style>
