<script setup lang="ts">
import { Archive, BookOpenText, Clipboard, Gavel, ListChecks, MessageSquare, RefreshCw } from 'lucide-vue-next'
import { Button } from './ui'
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
  // 完成后再安排下次轮询，慢请求、手动点击和切回标签页不会堆叠请求。
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
        // 只读取统计，不触发爬虫，也不显示“任务派发成功”。
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
const numberText = (value: number) => value.toLocaleString('zh-CN')
const queueTotal = computed(() => data.value?.queues.reduce((total, queue) => total + queue.size, 0))
const formatTimestamp = (value: string) => format(value, 'YYYY-MM-DD HH:mm:ss')
</script>
<template>
  <div class="archive-ui"><div class="site-overview">
    <div class="judgement-header-stack">
      <ArchivePageHeader title="站点概览" description="归档统计与任务状态" icon="activity" />
      <div class="archive-card judgement-toolbar"><div class="archive-card-footer judgement-heading-footer">
        <span class="judgement-heading-updated"><template v-if="data">更新于 <time :datetime="data.generated_at">{{ formatTimestamp(data.generated_at) }}</time></template><template v-else>等待数据</template></span>
        <ArchiveUpdateButton :state="pending ? 'pending' : refreshState" :message="error" @update="refreshOverview(true)" />
      </div></div>
    </div>
    <div v-if="error" class="site-overview-error" role="alert"><span>{{ data ? '刷新失败，当前保留上次数据。' + error : '统计加载失败。' + error }}</span><Button variant="outline" size="sm" :disabled="pending" @click="refreshOverview(true)"><RefreshCw :size="14" aria-hidden="true" />重试</Button></div>
    <section aria-label="站点总量" :aria-busy="pending && !data" class="site-metrics">
      <div v-for="metric in metrics" :key="metric.key" class="archive-card site-metric"><div class="site-metric-label"><component :is="metric.icon" :size="17" :stroke-width="1.7" aria-hidden="true" /><span>{{ metric.label }}</span></div>
        <strong class="site-metric-value" :data-long="data && String(data.totals[metric.key]).length > 10 ? true : undefined">{{ data ? numberText(data.totals[metric.key]) : '—' }}</strong>
      </div>
    </section>
    <section class="site-section" aria-labelledby="site-queues-heading" :aria-busy="pending && !data">
      <header class="site-section-heading"><h2 id="site-queues-heading">处理通道</h2><span>{{ queueTotal === undefined ? '—' : '合计 ' + numberText(queueTotal) + ' 个任务' }}</span></header>
      <dl v-if="data?.queues.length" class="site-queues"><div v-for="queue in data.queues" :key="queue.key" class="site-queue"><dt><span>{{ queue.label }}</span><code>{{ queue.key }}</code></dt><dd>{{ numberText(queue.size) }}</dd></div></dl>
      <p v-else class="site-overview-empty" :role="!data ? 'status' : undefined">{{ !data && pending ? 'loading……' : '暂无队列数据' }}</p>
    </section>
    <section class="site-section" aria-labelledby="site-recent-heading" :aria-busy="pending && !data">
      <header class="site-section-heading"><h2 id="site-recent-heading">最近保存任务</h2><Archive :size="17" aria-hidden="true" /></header>
      <p v-if="!data || !data.recent_tasks.length" class="site-overview-empty" :role="!data ? 'status' : undefined">{{ !data ? pending ? 'loading……' : '暂无任务数据' : '暂无爬取任务' }}</p>
      <template v-else>
        <div class="site-tasks-table"><table><caption class="site-sr-only">最近保存任务，按开始时间倒序</caption><thead><tr><th scope="col">类型</th><th scope="col">目标</th><th scope="col">触发</th><th scope="col">状态</th><th scope="col">时间</th></tr></thead><tbody>
          <tr v-for="task in data.recent_tasks" :key="task.id"><td>{{ taskTypes[task.task_type] || task.task_type }}</td><td><code>{{ task.target }}</code></td><td>{{ triggers[task.trigger] || task.trigger }}</td><td><span class="site-task-status" :data-status="task.status"><span aria-hidden="true" />{{ statuses[task.status] || task.status }}</span></td><td><time :datetime="task.started_at" :title="formatTimestamp(task.started_at)">{{ smart(task.started_at) }}</time></td></tr>
        </tbody></table></div>
        <ul class="site-task-list" aria-label="最近保存任务"><li v-for="task in data.recent_tasks" :key="task.id">
          <div class="site-task-mobile-heading"><strong>{{ taskTypes[task.task_type] || task.task_type }}</strong><span class="site-task-status" :data-status="task.status"><span aria-hidden="true" />{{ statuses[task.status] || task.status }}</span></div>
          <code>{{ task.target }}</code><div class="site-task-mobile-meta"><span>{{ triggers[task.trigger] || task.trigger }}</span><time :datetime="task.started_at" :title="formatTimestamp(task.started_at)">{{ smart(task.started_at) }}</time></div>
        </li></ul>
      </template>
    </section>
  </div></div>
</template>
<style src="~/assets/css/site-overview.css" />
