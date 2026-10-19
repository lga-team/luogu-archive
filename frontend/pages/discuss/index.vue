<script setup lang="ts">
import { LayoutGrid, Loader2, RefreshCw } from '@lucide/vue'

const api = useApi()
const { format } = useTime()
const page = ref(1)
const selectedForum = ref('')
const pageSize = 30

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

interface ForumItem {
  name: string
  slug: string
  count: number
}

interface DiscussionItem {
  discussion_id: number
  title: string
  author: UserBrief | null
  forum_name: string | null
  source_time: string | null
  crawled_at: string
  stored_reply_count: number
  latest_reply_author: UserBrief | null
  latest_reply_time: string | null
}

interface DiscussionListResponse {
  items: DiscussionItem[]
  forums: ForumItem[]
  total: number
  page: number
  page_size: number
}

const { data, pending, refresh: refreshList } = useLazyAsyncData(
  'discussion-list',
  () => api<DiscussionListResponse>('/discuss', {
    query: {
      page: page.value,
      page_size: pageSize,
      forum: selectedForum.value || undefined,
    },
  }),
  { server: false, watch: [page, selectedForum] },
)

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / pageSize)))
const refreshState = ref<'idle' | 'pending' | 'success' | 'cooldown' | 'failed'>('idle')
const refreshLabel = computed(() => ({
  idle: '更新',
  pending: '提交中',
  success: '已提交',
  cooldown: '稍后再试',
  failed: '更新失败',
}[refreshState.value]))

const refreshClass = computed(() => ({
  idle: '',
  pending: '',
  success: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  cooldown: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  failed: 'border-destructive/40 text-destructive',
}[refreshState.value]))

const forumDot: Record<string, string> = {
  siteaffairs: 'bg-[var(--lg-blue)]',
  academics: 'bg-[var(--lg-purple)]',
  service: 'bg-[var(--lg-green)]',
}

const forumDotClass = (slug: string) => forumDot[slug] || 'bg-[var(--lg-orange)]'

async function updateDiscussions() {
  if (refreshState.value === 'pending') return
  refreshState.value = 'pending'
  try {
    const result = await api<{ queued: boolean; message: string; retry_after: number }>('/discuss/refresh', {
      method: 'POST',
    })
    refreshState.value = result.queued ? 'success' : 'cooldown'
    if (result.queued) {
      window.setTimeout(() => void refreshList(), 3000)
    }
  } catch {
    refreshState.value = 'failed'
  }
  window.setTimeout(() => { refreshState.value = 'idle' }, 4000)
}

function chooseForum(slug: string) {
  if (selectedForum.value === slug) return
  selectedForum.value = slug
  page.value = 1
}

useHead({ title: '讨论区 - 洛谷档案馆' })

</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">讨论区</h1>
        <p class="mt-1 text-sm text-muted-foreground">浏览已归档的洛谷讨论主帖与回复</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        :class="refreshClass"
        :disabled="refreshState === 'pending'"
        @click="updateDiscussions"
      >
        <Loader2 v-if="refreshState === 'pending'" class="size-4 animate-spin" />
        <RefreshCw v-else class="size-4" />
        {{ refreshLabel }}
      </Button>
    </header>

    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card class="min-w-0 gap-0 py-0 lg:sticky lg:top-5">
        <nav class="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible" aria-label="讨论版块">
          <p class="hidden px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground lg:block">版块</p>
          <Button
            variant="ghost"
            class="h-auto shrink-0 justify-start gap-2.5 px-2 py-2 text-sm font-normal"
            :class="!selectedForum ? 'bg-accent text-foreground' : 'text-muted-foreground'"
            @click="chooseForum('')"
          >
            <LayoutGrid class="size-3.5" />
            <span class="whitespace-nowrap">全部版块</span>
          </Button>
          <Button
            v-for="forum in data?.forums || []"
            :key="forum.slug"
            variant="ghost"
            class="h-auto shrink-0 justify-start gap-2.5 px-2 py-2 text-sm font-normal"
            :class="selectedForum === forum.slug ? 'bg-accent text-foreground' : 'text-muted-foreground'"
            @click="chooseForum(forum.slug)"
          >
            <span class="size-2 shrink-0 rounded-sm" :class="forumDotClass(forum.slug)" />
            <span class="whitespace-nowrap">{{ forum.name }}</span>
            <span class="ml-auto hidden text-xs tabular-nums text-muted-foreground lg:inline">
              {{ forum.count }}
            </span>
          </Button>
        </nav>
      </Card>

      <div class="min-w-0 space-y-4">
        <div v-if="pending && !data" class="space-y-2.5">
          <div v-for="i in 6" :key="i" class="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 rounded-lg border border-border bg-card px-[13px] py-3 min-[820px]:grid-cols-[46px_minmax(0,1fr)_minmax(220px,32%)] min-[820px]:px-[18px] min-[820px]:py-3.5 min-[820px]:min-h-[88px]">
            <Skeleton class="size-10 shrink-0 rounded-full" />
            <div class="min-w-0 space-y-2">
              <Skeleton class="h-4 w-3/5" />
              <Skeleton class="h-3 w-2/5" />
            </div>
          </div>
        </div>

        <div v-else class="space-y-2.5">
          <NuxtLink
            v-for="item in data?.items || []"
            :key="item.discussion_id"
            :to="`/discuss/${item.discussion_id}`"
            class="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40 min-[820px]:grid-cols-[46px_minmax(0,1fr)_minmax(220px,32%)] min-[820px]:gap-x-4 min-[820px]:py-3.5"
          >
            <UserAvatar :user="item.author" size="xl" class="shrink-0" />

            <div class="min-w-0">
              <strong class="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">{{ item.title }}</strong>
              <div class="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <LuoguUserName
                  v-if="item.author"
                  :user="item.author"
                  show-badge
                  no-link
                  truncate
                  class="max-w-[5.5rem] shrink-0 min-[820px]:max-w-none"
                />
                <span v-else class="shrink-0">发帖人未收录</span>
                <time class="shrink-0" :datetime="item.source_time || item.crawled_at">
                  {{ format(item.source_time || item.crawled_at) }}
                </time>
              </div>
            </div>

            <div class="col-start-2 grid min-w-0 justify-items-start gap-2 text-xs text-muted-foreground min-[820px]:col-auto min-[820px]:justify-items-end">
              <Badge variant="secondary" class="h-5 max-w-full px-1.5 font-normal">
                <span class="truncate">{{ item.forum_name || '未知版块' }}</span>
              </Badge>
              <div class="flex min-w-0 items-center gap-x-2 whitespace-nowrap">
                <span class="shrink-0 tabular-nums">{{ item.stored_reply_count }} 条回复</span>
                <template v-if="item.latest_reply_author">
                  <LuoguUserName :user="item.latest_reply_author" show-badge no-link truncate class="min-w-0" />
                  <time v-if="item.latest_reply_time" class="shrink-0" :datetime="item.latest_reply_time">
                    {{ format(item.latest_reply_time) }}
                  </time>
                </template>
              </div>
            </div>
          </NuxtLink>

          <div v-if="!data?.items.length" class="rounded-lg border border-dashed border-border py-16 text-center">
            <p class="text-sm text-muted-foreground">这个版块暂时没有已归档讨论</p>
          </div>
        </div>

        <Pagination
          v-if="totalPages > 1"
          v-slot="{ page: current }"
          :page="page"
          :total="data?.total || 0"
          :items-per-page="pageSize"
          :sibling-count="1"
          show-edges
          @update:page="(p: number) => (page = p)"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious aria-label="上一页" />

            <template v-for="(item, index) in items">
              <PaginationItem
                v-if="item.type === 'page'"
                :key="`p-${item.value}`"
                :value="item.value"
                :is-active="item.value === current"
                :aria-label="`第 ${item.value} 页`"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :key="`e-${index}`" :index="index" />
            </template>

            <PaginationNext aria-label="下一页" />
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  </div>
</template>
