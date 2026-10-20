<script setup lang="ts">
import { ArrowUpRight, ChartNoAxesColumn, Check, Copy, ExternalLink } from '@lucide/vue'

const route = useRoute()
const api = useApi()
const { smart, format, fromNow } = useTime()
const uid = route.params.uid as string

interface UserNameHistoryItem {
  name: string
  color: string
  badge: string | null
  ccf_level: number
  xcpc_level: number
  first_seen_at: string
  last_seen_at: string
  is_hidden: boolean
}

interface UserProfile {
  uid: number
  name: string
  avatar: string | null
  background: string | null
  slogan: string | null
  badge: string | null
  color: string
  is_admin: boolean
  is_banned: boolean
  ccf_level: number
  xcpc_level: number
  following_count: number
  follower_count: number
  ranking: number | null
  passed_problem_count: number | null
  submitted_problem_count: number | null
  register_time: string | null
  introduction_md: string | null
  last_crawled_at: string | null
  name_history: UserNameHistoryItem[]
  prizes: Array<{ year: number; contest: string; event: string | null; prize: string; score: number | null; rank: number | null }>
  name_hidden: boolean
}

interface ActivityItem {
  kind: string
  time: string
  feed_id?: number
  feed_content?: string
  feed_merged_suffix_md?: string | null
  feed_merged_from_id?: number | null
  feed_merged_link_md?: string[]
  feed_merged_image_md?: string[]
  article_id?: string
  article_title?: string
  paste_id?: string
  discussion_id?: number
  discussion_title?: string
  discussion_excerpt?: string
  discussion_reply_count?: number
  discussion_reply_id?: number
  discussion_reply_page?: number
  discussion_reply_excerpt?: string
  judgement_reason?: string
  judgement_revoked?: number
  judgement_added?: number
}

// 活动种类的中文标签
const KIND_LABEL: Record<string, string> = {
  feed: '动态',
  article: '文章',
  paste: '剪贴板',
  discussion: '发起讨论',
  discussion_reply: '回复讨论',
  judgement: '陶片放逐',
}

// 陶片权限位图（沿用陶片页的常量，单点维护建议后续抽 composable）
const PERMISSION_MAP: Array<[number, string]> = [
  [1, '登录授权'],
  [2, '进入主站'],
  [4, '进入后台'],
  [8, '题目管理'],
  [16, '团队管理'],
  [32, '比赛管理'],
  [64, '讨论管理'],
  [256, '用户管理'],
  [512, '专栏管理'],
  [32768, '自由发言'],
  [65536, '发送私信'],
  [131072, '使用专栏'],
  [524288, '使用图床'],
  [2097152, '题目志愿者'],
  [4194304, '专栏志愿者'],
]

function describePermission(bits: number): string[] {
  if (!bits) return []
  const out: string[] = []
  let remaining = bits
  for (const [v, label] of PERMISSION_MAP) {
    if ((bits & v) === v) {
      out.push(label)
      remaining &= ~v
    }
  }
  if (remaining) out.push(`未知位 (${remaining})`)
  return out
}

// 用户页不阻塞首屏：资料回来前先显示加载窗口。
const { data: profile, error, pending: profilePending, refresh } = useLazyAsyncData(`user-${uid}`, () =>
  api<UserProfile>(`/user/${uid}`),
  { server: false },
)

// 活动分四类：全部 / 专栏（文章、剪贴板）/ 动态（犇犇）/ 陶片（放逐记录）。
// 接口只提供 include_feed 与 include_discussion，其余类型始终返回，
// 所以专栏、动态、陶片的区分在前端做；过滤后不足一屏时继续往后翻页补齐。
type ActivityTab = 'all' | 'column' | 'feed' | 'judgement'
const activeKind = ref<ActivityTab>('all')

const ACTIVITY_TABS: Array<{ key: ActivityTab; label: string }> = [
  { key: 'all', label: '活动' },
  { key: 'column', label: '专栏' },
  { key: 'feed', label: '动态' },
  { key: 'judgement', label: '陶片' },
]

// 活动列表分页：游标 = 列表最后一条的 time（更老的时间）
const activity = ref<ActivityItem[]>([])
const activityLoading = ref(false)
const activityNoMore = ref(false)
const activityBefore = ref<string | null>(null)
// 切换分类后丢弃旧请求结果，避免快速切换时串入上一次的数据。
let activityRequestVersion = 0
const PAGE_SIZE = 50
const ACTIVITY_MIN_ROWS = 10

function matchesTab(item: ActivityItem, tab: ActivityTab) {
  if (tab === 'all') return true
  if (tab === 'column') return item.kind === 'article' || item.kind === 'paste'
  if (tab === 'judgement') return item.kind === 'judgement'
  return item.kind === 'feed'
}

async function fetchActivity(reset: boolean) {
  const tab = activeKind.value
  const version = ++activityRequestVersion
  if (reset) {
    activity.value = []
    activityBefore.value = null
    activityNoMore.value = false
  }
  activityLoading.value = true
  try {
    for (let round = 0; round < 4; round++) {
      const query: Record<string, any> = {
        include_feed: tab === 'all' || tab === 'feed',
        include_discussion: tab === 'all',
        limit: PAGE_SIZE,
      }
      if (activityBefore.value) query.before = activityBefore.value

      const page = await api<ActivityItem[]>(`/user/${uid}/activity`, { query })
      if (version !== activityRequestVersion) return

      if (!page.length) {
        activityNoMore.value = true
        break
      }
      activityBefore.value = page[page.length - 1].time
      if (page.length < PAGE_SIZE) activityNoMore.value = true

      activity.value.push(...page.filter(item => matchesTab(item, tab)))
      if (activity.value.length >= ACTIVITY_MIN_ROWS || activityNoMore.value) break
    }
  } finally {
    if (version === activityRequestVersion) activityLoading.value = false
  }
}

const activityInitialPending = computed(() => activityLoading.value && activity.value.length === 0)

function loadMoreActivity() {
  if (activityLoading.value || activityNoMore.value) return
  void fetchActivity(false)
}

// 滚动到底自动加载下一页；切 tab 时 sentinel 随内容重建，watch 会重新绑定
const activitySentinel = ref<HTMLElement | null>(null)
let activityObserver: IntersectionObserver | null = null

watch(activitySentinel, (el) => {
  activityObserver?.disconnect()
  if (!el) return
  activityObserver = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) loadMoreActivity()
  }, { rootMargin: '240px 0px' })
  activityObserver.observe(el)
})

onBeforeUnmount(() => activityObserver?.disconnect())

watch(activeKind, () => { void fetchActivity(true) })
onMounted(() => { if (!activity.value.length) void fetchActivity(true) })

// 首屏用户未收录时活动接口同样返回空，并把 noMore 置真；只重查资料会让活动区
// 一直停在「暂无活动记录」，所以重新加载要把两者一起重查。
async function reload() {
  await refresh()
  if (profile.value) void fetchActivity(true)
}

const { render } = useMarkdown()
const introHtml = computed(() =>
  profile.value?.introduction_md ? render(profile.value.introduction_md) : '',
)
const { feedHtml } = useFeedContent()

const copiedIntroOriginal = ref(false)
async function copyIntroOriginal() {
  if (!profile.value?.introduction_md) return
  await navigator.clipboard.writeText(profile.value.introduction_md)
  copiedIntroOriginal.value = true
  setTimeout(() => { copiedIntroOriginal.value = false }, 1400)
}

const userBrief = computed(() => profile.value ? {
  uid: profile.value.uid,
  name: profile.value.name,
  color: profile.value.color,
  badge: profile.value.badge,
  avatar: profile.value.avatar,
  ccf_level: profile.value.ccf_level,
  xcpc_level: profile.value.xcpc_level,
  is_admin: profile.value.is_admin,
} : null)

interface CollapsedNameHistoryItem extends UserNameHistoryItem {
  id: string
}

// 兼容旧数据：只合并时间线上相邻且外显完全相同的快照，不跨越中间变化。
const nameHistory = computed<CollapsedNameHistoryItem[]>(() => {
  const ordered = [...(profile.value?.name_history ?? [])].sort(
    (a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime(),
  )
  const collapsed: CollapsedNameHistoryItem[] = []

  for (const entry of ordered) {
    const key = [
      entry.is_hidden ? 'hidden' : entry.name,
      entry.color,
      entry.badge ?? '',
      entry.ccf_level,
      entry.xcpc_level,
    ].join('|')
    const tail = collapsed[collapsed.length - 1]
    const tailKey = tail
      ? [
          tail.is_hidden ? 'hidden' : tail.name,
          tail.color,
          tail.badge ?? '',
          tail.ccf_level,
          tail.xcpc_level,
        ].join('|')
      : null

    if (tail && tailKey === key) {
      if (new Date(entry.first_seen_at) < new Date(tail.first_seen_at)) {
        tail.first_seen_at = entry.first_seen_at
      }
      if (new Date(entry.last_seen_at) > new Date(tail.last_seen_at)) {
        tail.last_seen_at = entry.last_seen_at
      }
      continue
    }

    collapsed.push({
      ...entry,
      id: `${entry.first_seen_at}-${collapsed.length}`,
    })
  }
  return collapsed
})

function historyUser(entry: UserNameHistoryItem) {
  return {
    uid: profile.value?.uid ?? Number(uid),
    name: entry.name,
    color: entry.color,
    badge: entry.badge,
    avatar: null,
    ccf_level: entry.ccf_level,
    xcpc_level: entry.xcpc_level,
  }
}

// 左侧 Tab 切换
type TabKey = 'activity' | 'intro' | 'prizes' | 'names'
const activeTab = ref<string>('activity')

const tabs: Array<{ key: TabKey; label: string; show: () => boolean }> = [
  { key: 'activity', label: '活动', show: () => true },
  { key: 'intro', label: '个人介绍', show: () => !!profile.value?.introduction_md },
  { key: 'prizes', label: 'OI 获奖', show: () => (profile.value?.prizes?.length ?? 0) > 0 },
  { key: 'names', label: '用户名历史', show: () => nameHistory.value.length > 1 },
]

const visibleTabs = computed(() => tabs.filter(t => t.show()))

const stats = computed(() => {
  const p = profile.value
  if (!p) return []
  return [
    { label: '关注', value: String(p.following_count) },
    { label: '粉丝', value: String(p.follower_count) },
    ...(p.ranking !== null ? [{ label: '做题榜', value: `#${p.ranking}` }] : []),
    ...(p.ccf_level > 0 ? [{ label: 'CCF', value: String(p.ccf_level) }] : []),
    ...(p.xcpc_level > 0 ? [{ label: 'XCPC', value: String(p.xcpc_level) }] : []),
  ]
})

// 代码复制按钮：绑在右侧内容容器上，覆盖 activity / intro 两种 md 场景
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

// XCPC 的 score 是浮点（penalty 算法），OI 是整数；整数原样、浮点保留 2 位小数
function formatScore(s: number): string {
  return Number.isInteger(s) ? String(s) : s.toFixed(2)
}
useHead(() => ({ title: profile.value ? `${profile.value.name_hidden ? `UID ${profile.value.uid}` : profile.value.name} - 洛谷档案馆` : '用户 - 洛谷档案馆' }))

</script>
<template>
  <div v-if="profilePending" class="grid items-start gap-6 lg:grid-cols-[268px_minmax(0,1fr)]">
    <aside class="flex min-w-0 flex-col gap-3">
      <Card class="gap-0 py-0">
        <div class="flex flex-col items-center px-5 py-6 text-center">
          <Skeleton class="size-20 rounded-full" />
          <Skeleton class="mt-3 h-6 w-28" />
          <Skeleton class="mt-1.5 h-4 w-40" />
          <div class="mt-4 flex w-full divide-x divide-border overflow-hidden rounded-md border border-border">
            <div v-for="i in 3" :key="i" class="flex-1 px-1 py-2.5">
              <Skeleton class="mx-auto h-3 w-8" />
              <Skeleton class="mx-auto mt-1 h-4 w-10" />
            </div>
          </div>
          <div class="mt-4 grid w-full grid-cols-2 gap-2">
            <Skeleton class="col-span-2 h-9 w-full rounded-md" />
            <Skeleton class="h-8 w-full rounded-md" />
            <Skeleton class="h-8 w-full rounded-md" />
            <Skeleton class="col-span-2 h-8 w-full rounded-md" />
          </div>
        </div>
      </Card>
      <div class="space-y-1">
        <Skeleton v-for="i in 3" :key="i" class="h-9 w-full rounded-md" />
      </div>
    </aside>
    <div class="min-w-0">
      <div class="flex items-center justify-between border-b border-border pb-3">
        <Skeleton class="h-8 w-52 rounded-md" />
        <Skeleton class="h-4 w-16" />
      </div>
      <div class="mt-4 space-y-2.5">
        <Skeleton v-for="i in 5" :key="i" class="h-20 rounded-xl" />
      </div>
    </div>
  </div>

  <NotArchivedNotice
    v-else-if="error"
    :title="error.data?.message || '用户未收录'"
    description="已触发一次爬取，点击重新加载即可。"
    @retry="reload()"
  />

  <div v-else-if="profile" class="space-y-4">
    <Tabs
      v-model="activeTab"
      orientation="vertical"
      class="grid items-start gap-6 lg:grid-cols-[268px_minmax(0,1fr)]"
    >
      <aside class="flex min-w-0 flex-col gap-3">
        <Card class="gap-0 py-0">
          <div class="flex flex-col items-center px-5 py-6 text-center">
            <UserAvatar :user="userBrief" size="2xl" />

            <h1 class="mt-3 text-lg font-semibold leading-snug text-foreground">
              <LuoguUserName :user="userBrief" :hidden="profile.name_hidden" show-badge no-link />
            </h1>

            <p v-if="profile.slogan" class="mt-1.5 text-sm text-muted-foreground">
              {{ profile.slogan }}
            </p>

            <div v-if="profile.is_banned || profile.is_admin" class="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge v-if="profile.is_banned" variant="destructive" class="h-5 px-1.5 font-normal">已封禁</Badge>
              <Badge
                v-if="profile.is_admin"
                variant="secondary"
                class="h-5 bg-[var(--lg-blue)]/12 px-1.5 font-normal text-[var(--lg-blue)]"
              >
                管理员
              </Badge>
            </div>

            <dl class="mt-4 flex w-full divide-x divide-border overflow-hidden rounded-md border border-border">
              <div v-for="s in stats" :key="s.label" class="flex-1 px-1 py-2.5">
                <dt class="text-[11px] leading-tight text-muted-foreground">{{ s.label }}</dt>
                <dd class="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{{ s.value }}</dd>
              </div>
            </dl>

            <div class="mt-4 grid w-full grid-cols-2 gap-2">
              <FollowButton :uid="profile.uid" class="col-span-2 w-full" />
              <Button variant="outline" size="sm" as-child class="w-full">
                <NuxtLink :to="`/user/${profile.uid}/card`">
                  <ChartNoAxesColumn class="size-3.5" />
                  图卡
                </NuxtLink>
              </Button>
              <Button variant="outline" size="sm" as-child class="w-full">
                <a
                  :href="`https://www.luogu.com.cn/user/${uid}`"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink class="size-3.5" />
                  查看源站
                </a>
              </Button>
              <SaveButton
                content-type="user"
                :content-id="String(uid)"
                class="col-span-2 w-full"
              />
            </div>

            <p v-if="profile.last_crawled_at" class="mt-3 text-[11px] text-muted-foreground">
              上次更新 {{ fromNow(profile.last_crawled_at) }}
            </p>
          </div>
        </Card>

        <TabsList class="h-auto w-full flex-col items-stretch">
          <TabsTrigger
            v-for="t in visibleTabs"
            :key="t.key"
            :value="t.key"
            class="h-9 justify-start"
          >
            {{ t.label }}
          </TabsTrigger>
        </TabsList>
      </aside>

      <div ref="contentRef" class="min-w-0">
        <TabsContent value="activity" class="mt-0">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <Tabs v-model="activeKind" class="w-auto">
              <TabsList class="h-8">
                <TabsTrigger
                  v-for="t in ACTIVITY_TABS"
                  :key="t.key"
                  :value="t.key"
                  class="flex-none text-xs"
                >
                  {{ t.label }}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span v-if="activity.length" class="text-xs text-muted-foreground">
              已加载 {{ activity.length }} 条
            </span>
          </div>

          <div v-if="activityInitialPending" class="mt-4 space-y-2.5">
            <Skeleton v-for="i in 5" :key="i" class="h-20 rounded-xl" />
          </div>

          <ul v-else-if="activity && activity.length" class="mt-4 space-y-2.5">
            <li
              v-for="(a, idx) in activity"
              :key="idx"
              class="group rounded-xl border border-border bg-card p-4"
            >
              <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <div class="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary" class="h-5 px-1.5 font-normal">
                    {{ KIND_LABEL[a.kind] || a.kind }}
                  </Badge>
                  <time class="tabular-nums">{{ smart(a.time) }}</time>
                </div>
                <span
                  v-if="a.kind === 'discussion' && a.discussion_reply_count != null"
                  class="shrink-0 tabular-nums"
                >
                  回复 {{ a.discussion_reply_count }}
                </span>
              </div>

              <template v-if="a.kind === 'feed'">
                <div
                  class="lg-content mt-2"
                  v-html="feedHtml(a.feed_content || '', a.feed_merged_suffix_md, a.feed_merged_link_md || [], a.feed_merged_image_md || [])"
                />
                <div class="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
                  <NuxtLink :to="`/feed/${a.feed_id}`" class="tabular-nums transition-colors hover:text-foreground">
                    #{{ a.feed_id }}
                  </NuxtLink>
                  <FeedReplyButton
                    :content="a.feed_content || ''"
                    :sender-name="profile.name_hidden ? `UID ${profile.uid}` : profile.name"
                  />
                </div>
              </template>

              <template v-else-if="a.kind === 'article'">
                <NuxtLink
                  :to="`/article/${a.article_id}`"
                  class="mt-1.5 flex items-center justify-between gap-3 text-[15px] font-semibold leading-snug tracking-tight text-foreground transition-colors hover:text-primary"
                >
                  <span class="truncate">{{ a.article_title || a.article_id }}</span>
                  <ArrowUpRight class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </NuxtLink>
              </template>

              <template v-else-if="a.kind === 'paste'">
                <NuxtLink
                  :to="`/paste/${a.paste_id}`"
                  class="mt-1.5 flex items-center justify-between gap-3 text-[15px] font-semibold leading-snug tracking-tight text-foreground transition-colors hover:text-primary"
                >
                  <span class="truncate">剪贴板 <span class="font-mono">{{ a.paste_id }}</span></span>
                  <ArrowUpRight class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </NuxtLink>
              </template>

              <template v-else-if="a.kind === 'discussion'">
                <h3 class="mt-1.5 truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                  <NuxtLink :to="`/discuss/${a.discussion_id}`" class="transition-colors hover:text-primary">
                    {{ a.discussion_title || `讨论 ${a.discussion_id}` }}
                  </NuxtLink>
                </h3>
                <p v-if="a.discussion_excerpt" class="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                  {{ a.discussion_excerpt }}
                </p>
              </template>

              <template v-else-if="a.kind === 'discussion_reply'">
                <p class="mt-1.5 text-[13px] text-muted-foreground">
                  在讨论
                  <NuxtLink
                    :to="a.discussion_reply_page ? `/discuss/${a.discussion_id}?page=${a.discussion_reply_page}#reply-${a.discussion_reply_id}` : `/discuss/${a.discussion_id}`"
                    class="font-medium text-foreground transition-colors hover:text-primary"
                  >《{{ a.discussion_title || `讨论 ${a.discussion_id}` }}》</NuxtLink>
                  回复：
                </p>
                <blockquote class="mt-2 border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted-foreground">
                  {{ a.discussion_reply_excerpt || '（暂无回复摘要）' }}
                </blockquote>
              </template>

              <template v-else-if="a.kind === 'judgement'">
                <div class="mt-2 space-y-2 border-l-2 border-border pl-3">
                  <Badge
                    variant="outline"
                    class="h-5 px-1.5 font-normal"
                    :class="(a.judgement_revoked ?? 0) === 0 && (a.judgement_added ?? 0) === 0
                      ? 'border-[var(--lg-cheater-tag)]/50 text-[var(--lg-cheater-tag)]'
                      : ((a.judgement_revoked ?? 0) > 0 ? 'border-destructive/50 text-destructive' : 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400')"
                  >
                    <template v-if="(a.judgement_revoked ?? 0) > 0 && (a.judgement_added ?? 0) === 0">
                      撤销权限
                    </template>
                    <template v-else-if="(a.judgement_added ?? 0) > 0 && (a.judgement_revoked ?? 0) === 0">
                      授予权限
                    </template>
                    <template v-else-if="(a.judgement_revoked ?? 0) === 0 && (a.judgement_added ?? 0) === 0">
                      棕名惩罚
                    </template>
                    <template v-else>
                      权限变更
                    </template>
                  </Badge>

                  <div v-if="describePermission(a.judgement_revoked ?? 0).length" class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="font-medium text-destructive">● 撤销</span>
                    <span
                      v-for="p in describePermission(a.judgement_revoked ?? 0)"
                      :key="`r-${idx}-${p}`"
                      class="rounded bg-muted px-2 py-0.5"
                    >{{ p }}</span>
                    <span class="text-muted-foreground">权限</span>
                  </div>

                  <div v-if="describePermission(a.judgement_added ?? 0).length" class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="font-medium text-emerald-600 dark:text-emerald-400">● 授予</span>
                    <span
                      v-for="p in describePermission(a.judgement_added ?? 0)"
                      :key="`a-${idx}-${p}`"
                      class="rounded bg-muted px-2 py-0.5"
                    >{{ p }}</span>
                    <span class="text-muted-foreground">权限</span>
                  </div>

                  <p class="mt-2 border-t border-dashed border-border pt-2 text-sm text-foreground">
                    {{ a.judgement_reason }}
                  </p>
                </div>
              </template>
            </li>
          </ul>

          <p v-else class="mt-10 text-center text-sm text-muted-foreground">暂无活动记录</p>

          <div v-if="activity && activity.length" class="mt-4 py-2 text-center">
            <span v-if="activityLoading" class="text-sm text-muted-foreground">加载中…</span>
            <p v-else-if="activityNoMore" class="text-xs text-muted-foreground">没有更多了</p>
            <span v-else ref="activitySentinel" />
          </div>
        </TabsContent>

        <TabsContent value="intro" class="mt-0">
          <div class="flex items-center justify-between border-b border-border pb-3">
            <h2 class="text-lg font-semibold text-foreground">个人介绍</h2>
            <Button type="button" variant="ghost" size="sm" @click="copyIntroOriginal">
              <Check v-if="copiedIntroOriginal" class="size-3.5" />
              <Copy v-else class="size-3.5" />
              {{ copiedIntroOriginal ? '已复制' : '复制原文' }}
            </Button>
          </div>
          <article class="lg-content mt-4" v-html="introHtml" />
        </TabsContent>

        <TabsContent value="prizes" class="mt-0">
          <h2 class="mb-3 text-lg font-semibold text-foreground">OI 获奖</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>年份</TableHead>
                <TableHead>赛事</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>奖项</TableHead>
                <TableHead>分数</TableHead>
                <TableHead>排名</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(p, idx) in profile.prizes" :key="`${idx}-${p.contest}-${p.prize}`">
                <TableCell class="tabular-nums">
                  <template v-if="p.year && p.year > 0">{{ p.year }}</template>
                  <span v-else class="text-xs text-muted-foreground">已隐藏</span>
                </TableCell>
                <TableCell>{{ p.contest }}</TableCell>
                <TableCell>{{ p.event || '—' }}</TableCell>
                <TableCell>{{ p.prize }}</TableCell>
                <TableCell v-if="p.score === null && p.rank === null" colspan="2" class="text-center text-xs text-muted-foreground">
                  已隐藏
                </TableCell>
                <template v-else>
                  <TableCell class="tabular-nums">{{ p.score !== null ? formatScore(p.score) : '—' }}</TableCell>
                  <TableCell class="tabular-nums">{{ p.rank !== null ? p.rank : '—' }}</TableCell>
                </template>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="names" class="mt-0">
          <div class="flex items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <h2 class="text-lg font-semibold text-foreground">历史用户名外显</h2>
              <p class="mt-0.5 text-xs text-muted-foreground">追踪最近的用户名外显变动记录。</p>
            </div>
            <span class="shrink-0 text-xs text-muted-foreground">{{ nameHistory.length }} 次记录</span>
          </div>

          <ol class="mt-4">
            <li
              v-for="(h, index) in nameHistory"
              :key="h.id"
              class="relative flex gap-3 pb-5"
            >
              <span
                v-if="index < nameHistory.length - 1"
                class="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-border"
                aria-hidden="true"
              />
              <span
                class="mt-1 size-2.5 shrink-0 rounded-full border-2"
                :class="index === 0 ? 'border-primary bg-primary' : 'border-border bg-card'"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <LuoguUserName
                  :user="historyUser(h)"
                  :hidden="h.is_hidden"
                  show-badge
                  no-link
                />
                <div class="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span :title="h.first_seen_at">
                    最早追溯到 {{ format(h.first_seen_at, 'YYYY/MM/DD') }}
                  </span>
                  <span :title="h.last_seen_at">
                    最后捕获于 {{ format(h.last_seen_at, 'YYYY/MM/DD') }}
                  </span>
                </div>
              </div>
            </li>
          </ol>
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>
