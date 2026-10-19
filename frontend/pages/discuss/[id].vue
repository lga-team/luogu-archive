<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'

const route = useRoute()
const api = useApi()
const { format } = useTime()
const { render } = useMarkdown()
const id = Number(route.params.id)
// 回复分页与洛谷一致，每页展示 10 条。
const perPage = 10
const currentPage = computed(() => Math.max(1, Number.parseInt(String(route.query.page || '1'), 10) || 1))

interface UserBrief {
  uid: number
  name: string
  color: string
  badge: string | null
  avatar: string | null
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
}

interface DiscussionReply {
  reply_id: number
  content_md: string
  author: UserBrief | null
  source_time: string | null
  crawled_at: string
}

interface DiscussionDetail {
  discussion_id: number
  title: string
  content_md: string
  author: UserBrief | null
  forum_name: string | null
  source_time: string | null
  crawled_at: string
  source_reply_count: number
  stored_reply_count: number
  page: number
  per_page: number
  replies: DiscussionReply[]
}

const { data, error, pending, refresh } = useLazyAsyncData(
  `discussion-${id}`,
  () => api<DiscussionDetail>(`/discuss/${id}`, {
    query: { page: currentPage.value, per_page: perPage },
  }),
  { server: false, watch: [currentPage] },
)

const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

// 回复数据异步加载，等目标页的 DOM 出现后再定位，不能只依赖浏览器首次跳锚点。
watch([() => data.value, () => route.hash], async () => {
  if (data.value?.page !== currentPage.value || !/^#reply-\d+$/.test(route.hash)) return
  await nextTick()
  contentRef.value?.querySelector(route.hash)?.scrollIntoView({ block: 'center' })
}, { flush: 'post' })

const copied = ref<string | null>(null)

async function copyMarkdown(key: string, content: string) {
  await navigator.clipboard.writeText(content)
  copied.value = key
  setTimeout(() => {
    if (copied.value === key) copied.value = null
  }, 1400)
}

function goPage(page: number) {
  if (page < 1 || page === currentPage.value) return
  navigateTo({ path: route.path, query: page === 1 ? {} : { page } })
}
useHead(() => ({ title: data.value ? `${data.value.title} - 洛谷档案馆` : '讨论 - 洛谷档案馆' }))

</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <div v-if="pending && !data" class="space-y-5 py-2">
      <Skeleton class="h-5 w-20" />
      <Skeleton class="h-8 w-4/5" />
      <div class="flex items-center gap-3">
        <Skeleton class="size-8 rounded-full" />
        <Skeleton class="h-4 w-40" />
      </div>
      <div class="space-y-2.5 pt-3">
        <Skeleton v-for="i in 10" :key="i" class="h-4" :class="i % 4 === 0 ? 'w-2/3' : 'w-full'" />
      </div>
    </div>

    <NotArchivedNotice
      v-else-if="error && !data"
      :title="error.data?.message || '加载失败'"
      :description="error.statusCode === 404 ? '首次保存已经进入队列，点击重新加载即可。' : null"
      @retry="refresh()"
    />

    <div v-else-if="data" ref="contentRef">
      <ContentHeader
        :label="data.forum_name || '讨论归档'"
        :author="data.author"
        :crawled-at="format(data.source_time || data.crawled_at)"
        date-label="发布于"
        :original-href="`https://www.luogu.com.cn/discuss/${id}`"
        :markdown="data.content_md"
        content-type="discuss"
        :content-id="String(id)"
      >
        {{ data.title }}
      </ContentHeader>

      <article class="lg-content mt-6" v-html="render(data.content_md)" />

      <section class="mt-8" aria-labelledby="reply-title">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 id="reply-title" class="text-lg font-semibold text-foreground">
              回复
            </h2>
            <p class="mt-1 text-xs text-muted-foreground">
              本站已归档 {{ data.stored_reply_count }} 条，源站记录 {{ data.source_reply_count }} 条
            </p>
          </div>
          <span class="text-xs text-muted-foreground">
            第 {{ currentPage }} / {{ Math.max(1, Math.ceil(data.stored_reply_count / perPage)) }} 页
          </span>
        </div>

        <div v-if="data.replies.length" class="mt-3 flex flex-col gap-3">
          <article
            v-for="reply in data.replies"
            :id="`reply-${reply.reply_id}`"
            :key="reply.reply_id"
            class="overflow-hidden rounded-lg border border-border bg-card"
          >
            <header class="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2 text-xs text-muted-foreground">
              <NuxtLink
                v-if="reply.author"
                :to="`/user/${reply.author.uid}`"
                class="flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-primary"
              >
                <UserAvatar :user="reply.author" size="md" />
                <LuoguUserName :user="reply.author" show-badge no-link truncate />
              </NuxtLink>
              <span v-else>用户未收录</span>

              <time v-if="reply.source_time" :datetime="reply.source_time">
                {{ format(reply.source_time) }}
              </time>

              <span class="ml-auto font-mono text-[11px] text-muted-foreground">
                #{{ reply.reply_id }}
              </span>

              <Button
                variant="ghost"
                size="sm"
                class="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                @click="copyMarkdown(`reply-${reply.reply_id}`, reply.content_md)"
              >
                <Check v-if="copied === `reply-${reply.reply_id}`" class="size-3" />
                <Copy v-else class="size-3" />
                {{ copied === `reply-${reply.reply_id}` ? '已复制' : '复制' }}
              </Button>
            </header>

            <div class="lg-content px-4 py-3" v-html="render(reply.content_md)" />
          </article>
        </div>
        <p v-else class="mt-3 rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          本页没有已归档回复。
        </p>

        <Pagination
          v-if="data.stored_reply_count > perPage"
          v-slot="{ page }"
          class="mt-5"
          :page="currentPage"
          :total="data.stored_reply_count"
          :items-per-page="perPage"
          :sibling-count="1"
          show-edges
          @update:page="goPage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious aria-label="上一页" />

            <template v-for="(item, index) in items">
              <PaginationItem
                v-if="item.type === 'page'"
                :key="`p-${item.value}`"
                :value="item.value"
                :is-active="item.value === page"
                :aria-label="`第 ${item.value} 页`"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :key="`e-${index}`" :index="index" />
            </template>

            <PaginationNext aria-label="下一页" />
          </PaginationContent>
        </Pagination>
      </section>
    </div>
  </div>
</template>
