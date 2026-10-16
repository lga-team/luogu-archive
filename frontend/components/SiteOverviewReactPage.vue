<script setup lang="ts">
import type { Root } from 'react-dom/client'
import type { SiteOverviewData, SiteOverviewProps } from '../react/site-overview'

const api = useApi()
const { format, smart } = useTime()
const host = ref<HTMLElement | null>(null)
const data = shallowRef<SiteOverviewData | null>(null)
const pending = ref(true)
const error = ref('')
const refreshState = ref('idle')
const mountFailed = ref(false)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | undefined
let controller: AbortController | undefined

function schedule() {
  clearTimeout(timer)
  if (!disposed && !mountFailed.value && !document.hidden) timer = setTimeout(() => { void refreshOverview() }, 10_000)
}
function refreshOverview(manual = false): Promise<void> | undefined {
  if (disposed || mountFailed.value || inFlight) return inFlight
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
onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { SiteOverview }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/site-overview'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    draw = () => {
      const props: SiteOverviewProps = {
        data: data.value, pending: pending.value, error: error.value, refreshState: refreshState.value,
        onRefresh: () => { void refreshOverview(true) },
        formatTime: smart, formatTimestamp: value => format(value, 'YYYY-MM-DD HH:mm:ss'),
      }
      root?.render(createElement(SiteOverview, props))
    }
    draw()
  } catch {
    if (!disposed) {
      mountFailed.value = true
      clearTimeout(timer)
      controller?.abort()
    }
  }
})
watch([data, pending, error, refreshState], () => draw?.())
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  controller?.abort()
  document.removeEventListener('visibilitychange', visibilityChanged)
  root?.unmount()
})
</script>

<template>
  <div ref="host" class="archive-react">
    <div class="site-overview">
      <div class="archive-card judgement-heading"><div class="archive-card-header judgement-heading-main"><span class="judgement-heading-icon" aria-hidden="true" /><div class="judgement-heading-copy"><h1>站点概览</h1><p class="archive-card-description">归档统计与任务状态</p></div></div></div>
      <p v-if="mountFailed" role="alert">页面组件加载失败，请刷新重试。</p>
      <p v-else role="status">loading……</p>
    </div>
  </div>
</template>

<style src="../react/archive.css" />
<style src="../react/site-overview.css" />
