<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'

const { smart } = useTime()

const api = useApi()

interface UserBrief {
  uid: number
  name: string
  color: string
  badge: string | null
  avatar: string | null
}
interface JudgementGroup {
  group_key: string
  reason: string
  revoked_permission: number
  added_permission: number
  time_start: string
  time_end: string
  users: UserBrief[]
  count: number
}

const PAGE_SIZE = 50

const groups = ref<JudgementGroup[]>([])
const loading = ref(false)
const noMore = ref(false)
const loadFailed = ref(false)
// 游标：取下一页时把这个值塞 ?before=
const beforeTs = ref<string | null>(null)

// 首屏不等待后端：先显示页面，再拉第一页陶片。
const { data: firstPage, pending: firstPending } = useLazyAsyncData('judgement-first', () =>
  api<JudgementGroup[]>('/judgement', { query: { limit: PAGE_SIZE } }),
  { server: false },
)
const { data: lastCrawled } = useLazyAsyncData('judgement-last-crawled', () =>
  api<{ last_crawled_at: string | null }>('/last-crawled?type=judgement'),
  { server: false },
)

watch(firstPage, (page) => {
  if (!page) return
  groups.value = [...page]
  // 用 time_end 倒序拿下一页：取最后一组的 time_start 当游标。
  // 注意：不能用 length < PAGE_SIZE 判 noMore，后端先拉原始记录再合并分组。
  beforeTs.value = page.length ? page[page.length - 1].time_start : null
  noMore.value = page.length === 0
}, { immediate: true })

async function loadMore() {
  if (loading.value || noMore.value) return
  loading.value = true
  loadFailed.value = false
  try {
    const q: Record<string, any> = { limit: PAGE_SIZE }
    if (beforeTs.value) q.before = beforeTs.value
    const page = await api<JudgementGroup[]>('/judgement', { query: q })
    if (page.length === 0) {
      noMore.value = true
    } else {
      // 去重：分页边界上同一条 judgement 可能在两页都被合并出来
      const seen = new Set(groups.value.map(g => g.group_key))
      const fresh = page.filter(g => !seen.has(g.group_key))
      groups.value.push(...fresh)
      // 去重后一无所获说明游标已越过全部记录，再翻也不会有新数据
      if (fresh.length === 0) noMore.value = true
      beforeTs.value = page[page.length - 1].time_start
    }
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

// 滚动到底自动加载下一页；sentinel 是 v-if 挂载的，用 watch 绑定而不是 onMounted
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) loadMore()
  }, { rootMargin: '240px 0px' })
})

watch(sentinel, (el) => {
  if (!observer) return
  if (el) observer.observe(el)
  else observer.disconnect()
})

onBeforeUnmount(() => observer?.disconnect())

watch(noMore, (v) => {
  if (v && sentinel.value) observer?.unobserve(sentinel.value)
})

/**
 * 洛谷权限位图。多个权限组合 = 数值相加（位或）。
 * 例：98304 = 32768 (自由发言) + 65536 (发送私信)。
 * 未确认的一律显示"未知位 (X)"，实测后逐步补齐。
 */
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

function actionTag(g: JudgementGroup) {
  if (g.revoked_permission > 0 && g.added_permission === 0) return { text: '撤销权限', cls: 'text-[var(--destructive)]' }
  if (g.added_permission > 0 && g.revoked_permission === 0) return { text: '授予权限', cls: 'text-[var(--success)]' }
  if (g.revoked_permission === 0 && g.added_permission === 0) return { text: '棕名惩罚', cls: 'text-[var(--lg-cheater-tag)]' }
  return { text: '权限变更', cls: 'text-muted-foreground' }
}

useHead({ title: '陶片放逐 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-muted-foreground">封禁公示归档</p>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">陶片放逐</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="lastCrawled?.last_crawled_at"
          class="text-xs text-muted-foreground"
        >上次更新 · {{ smart(lastCrawled.last_crawled_at) }}</span>
        <Button variant="outline" size="sm" as-child>
          <a href="https://www.luogu.com.cn/judgement" target="_blank" rel="noopener noreferrer">
            <ExternalLink class="size-3.5" />
            查看原文
          </a>
        </Button>
        <SaveButton content-type="judgement" content-id="all" />
      </div>
    </header>

    <!-- 首屏骨架：与陶片卡同构 -->
    <div v-if="firstPending && !groups.length" class="mt-4 space-y-2">
      <div v-for="i in 8" :key="i">
        <Card class="gap-2.5 py-3">
          <CardHeader class="px-3">
            <Skeleton class="h-3.5 w-16" />
            <CardAction>
              <Skeleton class="h-3 w-16" />
            </CardAction>
          </CardHeader>
          <CardContent class="space-y-2 px-3">
            <div class="flex gap-2">
              <Skeleton class="size-5 rounded-full" />
              <Skeleton class="h-4 w-20 self-center" />
              <Skeleton class="size-5 rounded-full" />
              <Skeleton class="h-4 w-16 self-center" />
            </div>
            <Skeleton class="h-3 w-full max-w-[60%]" />
          </CardContent>
        </Card>
      </div>
    </div>

    <ul v-else-if="groups.length" class="mt-4 list-none space-y-2">
      <li v-for="g in groups" :key="g.group_key">
        <Card class="gap-2.5 py-3">
          <!-- 顶部：权限变更头标 + 人数 + 时间 -->
          <CardHeader class="px-3">
            <CardTitle class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-semibold" :class="actionTag(g).cls">{{ actionTag(g).text }}</span>
              <span
                v-if="g.count > 1"
                class="rounded-full bg-[var(--warning)] px-2 py-px text-xs font-semibold text-white"
              >{{ g.count }} 人</span>
            </CardTitle>
            <CardAction>
              <span class="text-xs tabular-nums text-muted-foreground">{{ smart(g.time_end) }}</span>
            </CardAction>
          </CardHeader>

          <CardContent class="space-y-1.5 px-3">
            <!-- 用户（紧凑头像行） -->
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <NuxtLink
                v-for="u in g.users"
                :key="u.uid"
                :to="`/user/${u.uid}`"
                class="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-accent"
              >
                <UserAvatar :user="u" size="sm" />
                <span class="text-sm font-medium leading-none"><LuoguUserName :user="u" show-badge no-link /></span>
              </NuxtLink>
            </div>

            <!-- 权限明细 -->
            <div
              v-if="describePermission(g.revoked_permission).length || describePermission(g.added_permission).length"
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
            >
              <template v-if="describePermission(g.revoked_permission).length">
                <span class="font-medium text-[var(--destructive)]">撤销</span>
                <span
                  v-for="p in describePermission(g.revoked_permission)"
                  :key="`r-${p}`"
                  class="rounded bg-muted px-1.5 py-px text-xs"
                >{{ p }}</span>
              </template>
              <template v-if="describePermission(g.added_permission).length">
                <span class="ml-1 font-medium text-[var(--success)]">授予</span>
                <span
                  v-for="p in describePermission(g.added_permission)"
                  :key="`a-${p}`"
                  class="rounded bg-muted px-1.5 py-px text-xs"
                >{{ p }}</span>
              </template>
            </div>

            <!-- 原因 -->
            <p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{{ g.reason }}</p>
          </CardContent>
        </Card>
      </li>
    </ul>

    <p
      v-else
      class="mt-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
    >暂无数据</p>

    <!-- 滚动到底自动加载 -->
    <div v-if="groups.length && !noMore" ref="sentinel" class="mt-5 flex justify-center py-2">
      <span v-if="loading" class="text-sm text-muted-foreground">加载中…</span>
      <Button v-else-if="loadFailed" variant="outline" size="sm" @click="loadMore">加载失败，点击重试</Button>
    </div>
    <p v-else-if="groups.length && noMore" class="mt-5 text-center text-sm text-muted-foreground">没有更多了</p>
  </div>
</template>
