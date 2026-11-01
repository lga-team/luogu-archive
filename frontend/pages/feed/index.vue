<script setup lang="ts">
import { MessageSquareText } from 'lucide-vue-next'

const api = useApi()
const { smart } = useTime()
const PAGE_SIZE = 30

interface FeedItem {
  id: number
  type: number
  time: string
  content_md: string
  merged_suffix_md: string | null
  merged_from_id: number | null
  merged_link_md?: string[]
  merged_image_md?: string[]
  user: { uid: number; name: string; color: string; badge: string | null; avatar: string | null } | null
}

const { data: firstPage, pending: firstPending, error: firstError } = useLazyAsyncData('feed-first', () =>
  api<FeedItem[]>('/feed', { query: { limit: PAGE_SIZE } }),
  { server: false },
)

const items = ref<FeedItem[]>([])
const loading = ref(false)
const beforeTs = ref<string | null>(null)
const noMore = ref(false)

watch(firstPage, (page) => {
  if (!page) return
  items.value = [...page]
  beforeTs.value = page.length ? page[page.length - 1].time : null
  noMore.value = page.length === 0
}, { immediate: true })

async function loadMore() {
  if (loading.value || noMore.value) return
  loading.value = true
  try {
    const q: Record<string, any> = { limit: PAGE_SIZE }
    if (beforeTs.value) q.before = beforeTs.value
    const page = await api<FeedItem[]>('/feed', { query: q })
    items.value.push(...page)
    if (page.length === 0) noMore.value = true
    else beforeTs.value = page[page.length - 1].time
  } finally {
    loading.value = false
  }
}

const { render } = useMarkdown()
const completionTip = '此内容由洛谷档案馆根据回复链自动补全'

function markMergedMedia(html: string, links: string[], images: string[]) {
  let marked = html
  for (const link of links) {
    const anchor = render(link).match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
    if (!anchor || !marked.includes(anchor)) continue
    marked = marked.replace(
      anchor,
      `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged-link">${anchor}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`,
    )
  }
  for (const imageMd of images) {
    const image = render(imageMd).match(/<img\b[^>]*>/i)?.[0]
    if (!image || !marked.includes(image)) continue
    marked = marked.replace(
      image,
      `<span class="feed-completion-wrap feed-auto-merged-image" tabindex="0">${image}<span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`,
    )
  }
  return marked
}

function renderMergedSuffix(content: string, mergedSuffix: string) {
  const prefix = content.slice(0, Math.max(0, content.length - mergedSuffix.length))
  const prefixHtml = render(prefix)
  const suffixHtml = render(mergedSuffix)
  if ((prefix && !prefixHtml) || !suffixHtml) return ''
  const suffixParagraph = suffixHtml.match(/^<p>([\s\S]*)<\/p>\s*$/)
  if (!mergedSuffix.startsWith('\n') && suffixParagraph && /<\/p>\s*$/.test(prefixHtml)) {
    const markedSuffix = `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged">${suffixParagraph[1]}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`
    return prefixHtml.replace(/<\/p>\s*$/, `${markedSuffix}</p>`)
  }
  return prefixHtml
    + `<div class="feed-completion-wrap feed-completion-block" tabindex="0"><div class="feed-auto-merged">${suffixHtml}</div><span class="feed-completion-popover" role="tooltip">${completionTip}</span></div>`
}

function feedHtml(content: string, mergedSuffix: string | null, mergedLinks: string[], mergedImages: string[]) {
  let html = mergedSuffix ? renderMergedSuffix(content, mergedSuffix) : render(content)
  if (mergedLinks.length || mergedImages.length) html = markMergedMedia(html, mergedLinks, mergedImages)
  return html
}

const listRef = ref<HTMLElement | null>(null)
useCopyCode(listRef)
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="伪全网犇"
      description="汇总本站爬到的所有用户犇犇，按时间倒序排列。"
      eyebrow="Feed"
    >
      <template #icon><MessageSquareText :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span class="meta-item"><span class="tag tag--brand">实时归档</span></span>
      </template>
    </PageHeader>

    <LoadingPanel v-if="firstPending && !items.length" variant="list" :rows="5" title="正在加载犇犇" />

    <div v-else-if="firstError && !items.length" class="notice notice--warn" role="alert">
      <span>犇犇加载失败，请稍后刷新重试。</span>
    </div>

    <div v-else-if="!items.length" class="card">
      <EmptyState title="还没有犇犇" description="归档任务运行后会在这里出现内容。" />
    </div>

    <div v-else ref="listRef" class="feed-card-list">
      <article v-for="f in items" :key="f.id" class="card feed-card">
        <div class="feed-card__avatar">
          <NuxtLink v-if="f.user" :to="`/user/${f.user.uid}`" :aria-label="`${f.user.name} 的主页`">
            <LuoguAvatar :user="f.user" :size="44" />
          </NuxtLink>
          <LuoguAvatar v-else :size="44" />
        </div>
        <div class="feed-card__body">
          <header class="feed-card__meta">
            <LuoguUserName :user="f.user" show-badge />
            <span class="muted" style="font-size: 12px">{{ smart(f.time) }}</span>
          </header>
          <div class="markdown-body feed-card__content" v-html="feedHtml(f.content_md, f.merged_suffix_md, f.merged_link_md || [], f.merged_image_md || [])" />
          <footer class="feed-card__footer">
            <NuxtLink :to="`/feed/${f.id}`" class="feed-id">#{{ f.id }}</NuxtLink>
            <FeedReplyButton :content="f.content_md" :sender-name="f.user?.name" />
          </footer>
        </div>
      </article>
    </div>

    <div class="cluster" style="justify-content: center; padding: 6px 0">
      <FButton v-if="!noMore && items.length" appearance="outline" :loading="loading" @click="loadMore">
        {{ loading ? '加载中…' : '加载更多' }}
      </FButton>
      <span v-else-if="items.length" class="muted" style="font-size: 13px">没有更多了</span>
    </div>
  </div>
</template>

<style scoped>
.feed-card-list { display: flex; flex-direction: column; gap: 10px; }
.feed-card { display: flex; gap: 14px; padding: 16px 18px; }
.feed-card__avatar { flex-shrink: 0; }
.feed-card__avatar :deep(a) { display: block; border-radius: 50%; }
.feed-card__avatar img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; display: block; }
.feed-card__body { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.feed-card__meta { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; min-width: 0; }
.feed-card__content { font-size: 14.5px; line-height: 1.7; }
.feed-card__content :deep(img) { max-width: 100%; height: auto; border-radius: var(--borderRadiusMedium); }
.feed-card__footer { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.feed-id { color: var(--colorNeutralForeground3); font-family: var(--fontFamilyMonospace); font-size: 11px; text-decoration: none; }
.feed-id:hover { color: var(--colorBrandForegroundLink); }

/* 自动补全内容的下划线与悬浮说明 */
.feed-card__content :deep(.feed-completion-wrap) { position: relative; display: inline; cursor: help; outline: none; }
.feed-card__content :deep(.feed-completion-block) { display: block; width: fit-content; max-width: 100%; }
.feed-card__content :deep(.feed-auto-merged),
.feed-card__content :deep(.feed-auto-merged-link),
.feed-card__content :deep(.feed-auto-merged-link a) {
  text-decoration-line: underline; text-decoration-color: #7db9e8;
  text-decoration-thickness: 2px; text-underline-offset: 3px;
}
.feed-card__content :deep(.feed-auto-merged-image) { display: inline-block; max-width: 100%; box-shadow: 0 2px 0 #7db9e8; }
.feed-card__content :deep(.feed-completion-popover) {
  position: absolute; z-index: 30; top: calc(100% + 9px); left: 50%;
  display: none; width: max-content; max-width: 280px; padding: 8px 10px;
  transform: translateX(-50%); border: 1px solid var(--colorNeutralStroke2);
  border-radius: var(--borderRadiusMedium); background: var(--colorNeutralBackground1);
  color: var(--colorNeutralForeground1); box-shadow: var(--shadow16);
  font-size: 12px; line-height: 1.55; text-align: left; white-space: normal; pointer-events: none;
}
.feed-card__content :deep(.feed-completion-wrap:hover > .feed-completion-popover),
.feed-card__content :deep(.feed-completion-wrap:focus-within > .feed-completion-popover) { display: block; }

@media (max-width: 680px) {
  .feed-card { padding: 14px; gap: 11px; }
  .feed-card__avatar img, .feed-card__avatar :deep(fluent-avatar) { width: 38px; height: 38px; }
}
</style>
