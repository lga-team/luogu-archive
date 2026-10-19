<script setup lang="ts">
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

// `/feed` 列表页与 `/feed/{id}` 详情页是同级路由；首屏先显示，再拉第一页犇犇。
const { data: firstPage, pending: firstPending } = useLazyAsyncData('feed-first', () =>
  api<FeedItem[]>('/feed', { query: { limit: PAGE_SIZE } }),
  { server: false },
)

const items = ref<FeedItem[]>([])
const loading = ref(false)
const beforeTs = ref<string | null>(null)
const noMore = ref(false)

// 第一页回来后再填充列表，避免页面导航被接口阻塞。
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
    if (page.length === 0) {
      noMore.value = true
    } else {
      beforeTs.value = page[page.length - 1].time
    }
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

// 滚动到底自动加载下一页
const sentinel = ref<HTMLElement | null>(null)
const failed = ref(false)
let observer: IntersectionObserver | null = null

watch(sentinel, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) loadMore()
  }, { rootMargin: '240px 0px' })
  observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())

function retry() {
  failed.value = false
  loadMore()
}

const { feedHtml } = useFeedContent()

const listRef = ref<HTMLElement | null>(null)
useCopyCode(listRef)

useHead({ title: '伪全网犇 - 洛谷档案馆' })

</script>

<template>
  <div>
    <header class="border-b border-border pb-3">
      <h1 class="text-xl font-semibold tracking-tight">伪全网犇</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        汇总本站爬到的所有用户的犇犇，按时间倒序。
      </p>
    </header>

    <ul v-if="firstPending && !items.length" class="mt-4 space-y-2.5">
      <li v-for="i in 6" :key="i" class="flex gap-3 rounded-xl border border-border bg-card p-4">
        <Skeleton class="size-8 shrink-0 rounded-full" />
        <div class="min-w-0 flex-1 space-y-2.5">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-3.5 w-full max-w-[80%]" />
          <Skeleton class="h-3.5 w-full max-w-[55%]" />
        </div>
      </li>
    </ul>

    <template v-else>
      <ul v-if="items.length" ref="listRef" class="mt-4 space-y-2.5">
        <li
          v-for="f in items"
          :key="f.id"
          class="flex gap-3 rounded-xl border border-border bg-card p-4"
        >
          <NuxtLink :to="f.user ? `/user/${f.user.uid}` : ''" class="shrink-0" :class="{ 'pointer-events-none': !f.user }">
            <UserAvatar :user="f.user" size="lg" />
          </NuxtLink>

          <div class="min-w-0 flex-1 [overflow-wrap:anywhere] [&_a]:break-all">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <LuoguUserName :user="f.user" show-badge truncate />
              <time class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ smart(f.time) }}</time>
            </div>
            <div
              class="lg-content mt-2 [overflow-wrap:anywhere]"
              v-html="feedHtml(f.content_md, f.merged_suffix_md, f.merged_link_md || [], f.merged_image_md || [])"
            />
            <div class="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <NuxtLink :to="`/feed/${f.id}`" class="tabular-nums transition-colors hover:text-foreground">
                #{{ f.id }}
              </NuxtLink>
              <FeedReplyButton :content="f.content_md" :sender-name="f.user?.name" />
            </div>
          </div>
        </li>
      </ul>

      <div v-else class="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        还没有抓到任何犇犇
      </div>

      <div class="mt-5 flex justify-center py-2">
        <Button v-if="failed" variant="outline" size="sm" @click="retry">加载失败，点击重试</Button>
        <span v-else-if="loading" class="text-sm text-muted-foreground">加载中…</span>
        <span v-else-if="items.length && noMore" class="text-xs text-muted-foreground">没有更多了</span>
        <span v-else ref="sentinel" />
      </div>
    </template>
  </div>
</template>
