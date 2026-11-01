<script setup lang="ts">
import {
  Activity, Archive, BookOpenText, Clipboard, Gavel, ListChecks, MessageSquare, RefreshCw,
} from 'lucide-vue-next'
import type { SiteOverviewData } from '~/types/siteOverview'

const api = useApi()
const { format, smart } = useTime()
const data = shallowRef<SiteOverviewData | null>(null)
const pending = ref(true)
const error = ref('')
const refreshState = ref('idle')
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | undefined
let controller: AbortController | undefined

function schedule() {
  clearTimeout(timer)
  if (!disposed && !document.hidden) timer = setTimeout(() => { void refreshOverview() }, 10_000)
}
function refreshOverview(manual = false): Promise<void> | undefined {
  if (disposed || inFlight) return inFlight
  clearTimeout(timer)
  pending.value = true
  refreshState.value = 'idle'
  controller = new AbortController()
  const signal = controller.signal
  inFlight = (async () => {
    try {
      const result = await api<SiteOverviewData>('/site/overview', { signal, timeout: 20_000, retry: 0 })
      if (!disposed) { data.value = result; error.value = '' }
    } catch (reason: any) {
      if (!disposed && !signal.aborted) {
        error.value = reason?.data?.message || '请稍后重试。'
        if (manual) refreshState.value = 'failed'
      }
    } finally {
      if (!disposed) {
        pending.value = false
        inFlight = undefined
        controller = undefined
        schedule()
      }
    }
  })()
  return inFlight
}
function visibilityChanged() {
  clearTimeout(timer)
  if (!document.hidden) void refreshOverview()
}
onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  if (!document.hidden) void refreshOverview()
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  controller?.abort()
  document.removeEventListener('visibilitychange', visibilityChanged)
})

const metrics = [
  { key: 'crawl_tasks', label: '总保存任务', icon: ListChecks },
  { key: 'articles', label: '文章', icon: BookOpenText },
  { key: 'pastes', label: '剪贴板', icon: Clipboard },
  { key: 'feeds', label: '犇犇', icon: MessageSquare },
  { key: 'judgements', label: '陶片记录', icon: Gavel },
] as const

const taskTypes: Record<string, string> = { article: '文章', paste: '剪贴板', discussion: '讨论', discuss: '讨论', feed: '犇犇', judgement: '陶片', user: '用户', theme: '主题', problem: '题目', problem_list: '题目列表', problem_catalog: '题库同步', problem_solution: '题解状态', contest: '比赛', contest_scoreboard: '比赛榜单' }
const triggers: Record<string, string> = { manual: '手动', scheduled: '定时', passive: '访问触发', realtime: '实时监听', discovery: '入口发现', internal: '内部调度' }
const statuses: Record<string, string> = { pending: '等待中', running: '运行中', success: '成功', failed: '失败', skipped: '已跳过', rate_limited: '限流' }
const statusClass = (status: string) => status === 'success' ? 'tag--success' : status === 'failed' ? 'tag--danger' : status === 'running' ? 'tag--info' : 'tag'
const numberText = (value: number) => value.toLocaleString('zh-CN')
const queueTotal = computed(() => data.value?.queues.reduce((total, queue) => total + queue.size, 0))
const formatTimestamp = (value: string) => format(value, 'YYYY-MM-DD HH:mm:ss')
</script>

<template>
  <div class="page">
    <PageHeader
      title="站点概览"
      description="归档总量、处理通道与最近任务状态，每 10 秒自动刷新。"
      eyebrow="Site overview"
    >
      <template #icon><Activity :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <span v-if="data" class="meta-item muted">
          更新于 <time :datetime="data.generated_at">{{ formatTimestamp(data.generated_at) }}</time>
        </span>
        <ArchiveUpdateButton :state="pending ? 'pending' : refreshState" :message="error" @update="refreshOverview(true)" />
      </template>
    </PageHeader>

    <div v-if="error" class="notice notice--warn" role="alert">
      <span>{{ data ? '刷新失败，当前保留上次数据。' + error : '统计加载失败。' + error }}</span>
      <FButton appearance="subtle" size="small" :disabled="pending" @click="refreshOverview(true)">
        <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重试
      </FButton>
    </div>

    <section aria-label="站点总量" :aria-busy="pending && !data" class="metric-grid">
      <div v-for="metric in metrics" :key="metric.key" class="stat-card">
        <div class="metric-label">
          <component :is="metric.icon" :size="16" :stroke-width="1.7" aria-hidden="true" />
          <span>{{ metric.label }}</span>
        </div>
        <strong v-if="data" class="stat-card__value">{{ numberText(data.totals[metric.key]) }}</strong>
        <span v-else class="skeleton skeleton--stat" aria-hidden="true" />
      </div>
    </section>

    <div class="grid grid--2">
      <section class="card" aria-labelledby="site-queues-heading" :aria-busy="pending && !data">
        <div class="card__header">
          <div>
            <h2 id="site-queues-heading" class="card__title">处理通道</h2>
            <p class="card__description">{{ queueTotal === undefined ? '等待数据' : '合计 ' + numberText(queueTotal) + ' 个待处理任务' }}</p>
          </div>
        </div>
        <div class="card__body">
          <div v-if="data?.queues.length" class="queue-list">
            <div v-for="queue in data.queues" :key="queue.key" class="queue-row">
              <div class="queue-row__main">
                <span class="queue-row__label">{{ queue.label }}</span>
                <code class="code-inline">{{ queue.key }}</code>
              </div>
              <strong class="queue-row__value tabular">{{ numberText(queue.size) }}</strong>
            </div>
          </div>
          <div v-else-if="!data && pending" class="skeleton-queue" aria-hidden="true">
            <span v-for="i in 3" :key="i" class="skeleton skeleton--line" style="width: 100%; height: 28px" />
          </div>
          <p v-else class="muted">暂无队列数据</p>
        </div>
      </section>

      <section class="card" :aria-busy="pending && !data">
        <div class="card__header">
          <div>
            <h2 class="card__title">任务状态</h2>
            <p class="card__description">最近保存任务的类型分布与更新时间。</p>
          </div>
          <Archive :size="18" class="muted" aria-hidden="true" />
        </div>
        <div class="card__body">
          <LoadingPanel v-if="!data && pending" variant="list" :rows="3" compact title="正在加载任务状态" />
          <EmptyState
            v-else-if="!data || !data.recent_tasks.length"
            title="暂无任务"
            description="还没有最近的保存任务记录。"
          />
          <ul v-else class="recent-list">
            <li v-for="task in data.recent_tasks.slice(0, 6)" :key="task.id" class="recent-item">
              <div class="recent-item__main">
                <span class="recent-item__type">{{ taskTypes[task.task_type] || task.task_type }}</span>
                <code class="code-inline recent-item__target">{{ task.target }}</code>
              </div>
              <div class="recent-item__meta">
                <span class="tag" :class="statusClass(task.status)">{{ statuses[task.status] || task.status }}</span>
                <time class="muted" :datetime="task.started_at" :title="formatTimestamp(task.started_at)">{{ smart(task.started_at) }}</time>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <section class="page-section" aria-labelledby="site-recent-heading" :aria-busy="pending && !data">
      <div class="section-head">
        <div class="section-head__text">
          <h2 id="site-recent-heading" class="section-title">最近保存任务</h2>
          <span class="section-subtitle">按开始时间倒序，最多显示最近 20 条</span>
        </div>
      </div>
      <LoadingPanel v-if="!data && pending" variant="list" :rows="5" title="正在加载最近任务" />
      <EmptyState
        v-else-if="!data || !data.recent_tasks.length"
        title="暂无爬取任务"
        description="保存任务触发后会出现在这里。"
      />
      <div v-else class="table-wrap">
        <table class="table">
          <caption class="sr-only">最近保存任务，按开始时间倒序</caption>
          <thead>
            <tr>
              <th scope="col">类型</th>
              <th scope="col">目标</th>
              <th scope="col">触发</th>
              <th scope="col">状态</th>
              <th scope="col">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in data.recent_tasks" :key="task.id">
              <td>{{ taskTypes[task.task_type] || task.task_type }}</td>
              <td><code class="code-inline">{{ task.target }}</code></td>
              <td>{{ triggers[task.trigger] || task.trigger }}</td>
              <td><span class="tag" :class="statusClass(task.status)">{{ statuses[task.status] || task.status }}</span></td>
              <td><time :datetime="task.started_at" :title="formatTimestamp(task.started_at)">{{ smart(task.started_at) }}</time></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.metric-label { display: flex; align-items: center; gap: 6px; color: var(--colorNeutralForeground3); font-size: 12px; }
.stat-card__value { display: block; margin-top: 8px; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
.queue-list { display: flex; flex-direction: column; }
.queue-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--colorNeutralStroke2); }
.queue-row:last-child { border-bottom: 0; }
.queue-row__main { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.queue-row__label { font-size: 13px; font-weight: 500; }
.queue-row__value { font-size: 18px; }
.recent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.recent-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--colorNeutralStroke2); }
.recent-item:last-child { border-bottom: 0; }
.recent-item__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.recent-item__type { font-size: 13px; font-weight: 600; }
.recent-item__target { font-size: 11px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-item__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 11px; flex-shrink: 0; }
@media (max-width: 1080px) { .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 680px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .recent-item__target { max-width: 150px; }
}
.skeleton--stat { display: block; width: 108px; height: 34px; margin-top: 8px; border-radius: var(--borderRadiusMedium); }
.skeleton-queue { display: flex; flex-direction: column; gap: 8px; }
</style>
