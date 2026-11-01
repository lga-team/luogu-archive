<script setup lang="ts">
import { ArrowLeft, ExternalLink, MessageSquareText } from 'lucide-vue-next'

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

const route = useRoute()
const api = useApi()
const { smart } = useTime()
const { render } = useMarkdown()
const feedId = String(route.params.id)
const contentRef = ref<HTMLElement | null>(null)
const completionTip = '此内容由洛谷档案馆根据回复链自动补全'

const { data: feed, pending, error } = useLazyAsyncData(
  `feed-${feedId}`,
  () => api<FeedItem>(`/feed/${feedId}`),
  { server: false },
)

function markMergedMedia(html: string, links: string[], images: string[]) {
  let marked = html
  for (const link of links) {
    const anchor = render(link).match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
    if (!anchor || !marked.includes(anchor)) continue
    marked = marked.replace(anchor, `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged-link">${anchor}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`)
  }
  for (const imageMd of images) {
    const image = render(imageMd).match(/<img\b[^>]*>/i)?.[0]
    if (!image || !marked.includes(image)) continue
    marked = marked.replace(image, `<span class="feed-completion-wrap feed-auto-merged-image" tabindex="0">${image}<span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`)
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
    const marked = `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged">${suffixParagraph[1]}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`
    return prefixHtml.replace(/<\/p>\s*$/, `${marked}</p>`)
  }
  return prefixHtml + `<div class="feed-completion-wrap feed-completion-block" tabindex="0"><div class="feed-auto-merged">${suffixHtml}</div><span class="feed-completion-popover" role="tooltip">${completionTip}</span></div>`
}

function feedHtml(item: FeedItem) {
  let html = item.merged_suffix_md
    ? renderMergedSuffix(item.content_md, item.merged_suffix_md)
    : render(item.content_md)
  html = markMergedMedia(html, item.merged_link_md || [], item.merged_image_md || [])
  return html
}

useCopyCode(contentRef)
</script>

<template>
  <div class="page page--medium">
    <PageHeader title="犇犇详情" :description="feed ? `#${feed.id}` : `#${feedId}`" eyebrow="Feed">
      <template #icon><MessageSquareText :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" @click="navigateTo('/feed')">
          <template #start><ArrowLeft :size="16" aria-hidden="true" /></template>返回犇犇
        </FButton>
        <FButton appearance="outline" :href="'https://www.luogu.com.cn/feed/' + feedId" target="_blank">
          <template #start><ExternalLink :size="15" aria-hidden="true" /></template>查看原站
        </FButton>
      </template>
    </PageHeader>

    <LoadingPanel v-if="pending" variant="detail" title="正在加载犇犇" />
    <div v-else-if="error" class="card card__body">
      <EmptyState title="犇犇加载失败" :description="(error as any)?.data?.message || '请稍后重试。'">
        <template #actions><FButton appearance="outline" @click="navigateTo('/feed')">返回列表</FButton></template>
      </EmptyState>
    </div>

    <article v-else-if="feed" class="card feed-detail-card">
      <header class="feed-detail-head">
        <NuxtLink v-if="feed.user" :to="`/user/${feed.user.uid}`" class="feed-detail-avatar" :aria-label="`${feed.user.name} 的主页`">
          <LuoguAvatar :user="feed.user" :size="48" />
        </NuxtLink>
        <div class="stack stack--xs" style="flex:1 1 auto;min-width:0">
          <LuoguUserName :user="feed.user" show-badge />
          <span class="muted" style="font-size: 12px">{{ smart(feed.time) }}</span>
        </div>
        <FeedReplyButton :content="feed.content_md" :sender-name="feed.user?.name" />
      </header>
      <div ref="contentRef" class="markdown-body feed-detail-content" v-html="feedHtml(feed)" />
      <footer class="feed-detail-foot">
        <span class="feed-id">#{{ feed.id }}</span>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.feed-detail-card { padding: clamp(18px, 3vw, 26px); display: flex; flex-direction: column; gap: 14px; }
.feed-detail-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.feed-detail-avatar img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; display: block; }
.feed-detail-content { font-size: 15px; line-height: 1.75; }
.feed-detail-content :deep(img) { max-width: 100%; height: auto; border-radius: var(--borderRadiusMedium); }
.feed-detail-foot { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--colorNeutralStroke2); padding-top: 10px; }
.feed-id { color: var(--colorNeutralForeground3); font-family: var(--fontFamilyMonospace); font-size: 11px; }
.feed-detail-content :deep(.feed-completion-wrap) { position: relative; display: inline; cursor: help; outline: none; }
.feed-detail-content :deep(.feed-completion-block) { display: block; width: fit-content; max-width: 100%; }
.feed-detail-content :deep(.feed-auto-merged),
.feed-detail-content :deep(.feed-auto-merged-link),
.feed-detail-content :deep(.feed-auto-merged-link a) { text-decoration-line: underline; text-decoration-color: #7db9e8; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.feed-detail-content :deep(.feed-auto-merged-image) { display: inline-block; max-width: 100%; box-shadow: 0 2px 0 #7db9e8; }
.feed-detail-content :deep(.feed-completion-popover) {
  position: absolute; z-index: 30; top: calc(100% + 9px); left: 50%; display: none;
  width: max-content; max-width: 280px; padding: 8px 10px; transform: translateX(-50%);
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusMedium);
  background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);
  box-shadow: var(--shadow16); font-size: 12px; line-height: 1.55; white-space: normal; pointer-events: none;
}
.feed-detail-content :deep(.feed-completion-wrap:hover > .feed-completion-popover),
.feed-detail-content :deep(.feed-completion-wrap:focus-within > .feed-completion-popover) { display: block; }
</style>
