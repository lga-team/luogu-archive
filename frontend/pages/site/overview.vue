<script setup lang="ts">
import { ClipboardList, FileText, ListChecks, MessageSquare, RefreshCw, TrendingUp } from '@lucide/vue'

const api = useApi()
const { format, smart } = useTime()

interface SiteTotals {
  crawl_tasks: number
  articles: number
  pastes: number
  feeds: number
  judgements: number
}

interface QueueInfo {
  key: string
  label: string
  size: number
}

interface RecentTaskItem {
  id: number
  task_type: string
  target: string
  trigger: string
  status: string
  started_at: string
}

interface SiteOverview {
  generated_at: string
  totals: SiteTotals
  queues: QueueInfo[]
  recent_tasks: RecentTaskItem[]
}

const refreshing = ref(false)

const { data, pending, error, refresh } = useLazyAsyncData('site-overview', () =>
  api<SiteOverview>('/site/overview'),
  { server: false },
)

const { pause, resume } = useIntervalFn(() => {
  refreshOverview()
}, 10_000, { immediate: false })

onMounted(() => resume())
onBeforeUnmount(() => pause())

async function refreshOverview() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await refresh()
  } finally {
    refreshing.value = false
  }
}

const metricCards = computed(() => {
  const totals = data.value?.totals
  return [
    { key: 'crawl_tasks', label: '总保存任务', value: totals?.crawl_tasks ?? 0, icon: ListChecks },
    { key: 'articles', label: '文章', value: totals?.articles ?? 0, icon: FileText },
    { key: 'pastes', label: '剪贴板', value: totals?.pastes ?? 0, icon: ClipboardList },
    { key: 'feeds', label: '犇犇', value: totals?.feeds ?? 0, icon: MessageSquare },
    { key: 'judgements', label: '陶片记录', value: totals?.judgements ?? 0, icon: TrendingUp },
  ]
})

const maxQueueSize = computed(() =>
  Math.max(1, ...(data.value?.queues.map(q => q.size) ?? [0])),
)

function numberText(value: number): string {
  return value.toLocaleString('zh-CN')
}

function queuePressure(size: number): number {
  if (size <= 0) return 0
  return Math.max(4, Math.round((size / maxQueueSize.value) * 100))
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    article: '文章',
    paste: '剪贴板',
    discussion: '讨论',
    feed: '犇犇',
    judgement: '陶片',
    user: '用户',
    problem: '题目',
    problem_list: '题目列表',
    problem_catalog: '题库同步',
    problem_solution: '题解状态',
    contest: '比赛',
    contest_scoreboard: '比赛榜单',
  }
  return map[type] || type
}

function triggerLabel(trigger: string): string {
  const map: Record<string, string> = {
    manual: '手动',
    scheduled: '定时',
    passive: '访问触发',
    realtime: '实时监听',
    discovery: '入口发现',
    internal: '内部调度',
  }
  return map[trigger] || trigger
}

const statusCls: Record<string, string> = {
  success: 'text-[var(--lg-green)]',
  failed: 'text-[var(--lg-red)]',
  rate_limited: 'text-[var(--lg-red)]',
  running: 'text-[var(--lg-yellow)]',
  pending: 'text-[var(--lg-yellow)]',
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    success: '成功',
    failed: '失败',
    skipped: '已跳过',
    rate_limited: '限流',
  }
  return map[status] || status
}

useHead({ title: '站点概览 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <p class="text-xs font-medium tracking-wide text-muted-foreground">后台数据</p>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">站点概览</h1>
        <p class="mt-1 text-sm text-muted-foreground">归档内容与后台处理通道的实时数据。</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-[13px] text-muted-foreground">
          {{ data?.generated_at ? `更新于 ${format(data.generated_at, 'HH:mm:ss')}` : '等待数据' }}
        </span>
        <Button variant="outline" size="sm" :disabled="refreshing" @click="refreshOverview">
          <RefreshCw class="size-3.5" :class="refreshing && 'animate-spin'" />
          {{ refreshing ? '刷新中' : '刷新' }}
        </Button>
      </div>
    </header>

    <!-- 首屏骨架 -->
    <div v-if="pending && !data" class="mt-5 space-y-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Skeleton v-for="i in 5" :key="i" class="h-[74px] rounded-xl" />
      </div>
      <Skeleton class="h-72 rounded-xl" />
      <Skeleton class="h-80 rounded-xl" />
    </div>

    <!-- 加载失败 -->
    <div v-else-if="error" class="mt-5 rounded-xl border border-dashed border-border p-10 text-center">
      <h2 class="text-lg font-semibold">{{ error.data?.message || '加载失败' }}</h2>
      <Button variant="outline" size="sm" class="mt-4" @click="refreshOverview">重试</Button>
    </div>

    <div v-else-if="data" class="mt-5 space-y-4">
      <!-- 总量指标 -->
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="站点总量">
        <article
          v-for="card in metricCards"
          :key="card.key"
          class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4"
        >
          <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]">
            <component :is="card.icon" class="size-[18px]" />
          </div>
          <div class="grid min-w-0 gap-0.5">
            <span class="text-[13px] text-muted-foreground">{{ card.label }}</span>
            <strong class="truncate text-[23px] font-extrabold leading-tight">{{ numberText(card.value) }}</strong>
          </div>
        </article>
      </section>

      <!-- 处理通道 -->
      <Card class="gap-0 py-0">
        <CardHeader class="border-b border-border px-5 pb-4 pt-5">
          <CardTitle class="text-base">处理通道</CardTitle>
          <CardDescription class="text-[13px]">每 10 秒自动刷新。</CardDescription>
        </CardHeader>
        <CardContent class="px-0 py-0">
          <div
            v-for="(queue, i) in data.queues"
            :key="queue.key"
            class="grid grid-cols-[minmax(0,1fr)_86px] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[minmax(180px,1fr)_100px_minmax(240px,42%)]"
            :class="i > 0 && 'border-t border-border'"
          >
            <div class="grid min-w-0 gap-0.5">
              <strong class="text-[15px]">{{ queue.label }}</strong>
              <span class="font-mono text-xs text-muted-foreground">{{ queue.key }}</span>
            </div>
            <div class="text-right text-[22px] font-extrabold tabular-nums">{{ numberText(queue.size) }}</div>
            <div class="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1" aria-hidden="true">
              <span
                class="block h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--lg-cyan)]"
                :style="{ width: `${queuePressure(queue.size)}%` }"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 最近保存任务 -->
      <Card class="gap-0 py-0 overflow-hidden">
        <CardHeader class="border-b border-border px-5 pb-4 pt-5">
          <CardTitle class="text-base">最近保存任务</CardTitle>
          <CardDescription class="text-[13px]">按爬取任务开始时间倒序。</CardDescription>
        </CardHeader>
        <CardContent class="px-0 py-0">
          <div class="hidden grid-cols-[110px_minmax(0,1fr)_110px_110px_150px] items-center gap-3.5 border-b border-border bg-muted/60 px-5 py-2.5 text-xs font-bold text-muted-foreground sm:grid">
            <span>类型</span>
            <span>目标</span>
            <span>触发</span>
            <span>状态</span>
            <span>时间</span>
          </div>
          <div
            v-for="(item, i) in data.recent_tasks"
            :key="item.id"
            class="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm sm:grid-cols-[110px_minmax(0,1fr)_110px_110px_150px]"
            :class="i > 0 && 'border-t border-border'"
          >
            <span>{{ typeLabel(item.task_type) }}</span>
            <span class="truncate font-mono text-[13px]">{{ item.target }}</span>
            <span class="text-xs text-muted-foreground sm:text-sm">{{ triggerLabel(item.trigger) }}</span>
            <span>
              <span class="inline-flex rounded-full bg-muted px-2 py-px text-xs" :class="statusCls[item.status] || 'text-muted-foreground'">
                {{ statusLabel(item.status) }}
              </span>
            </span>
            <span class="text-xs text-muted-foreground sm:text-sm">{{ smart(item.started_at) }}</span>
          </div>
          <p v-if="!data.recent_tasks.length" class="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">暂无爬取任务</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
