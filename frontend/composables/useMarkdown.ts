import { getCurrentInstance, onMounted, shallowRef, type ShallowRef } from 'vue'

interface RenderEntry {
  html: ShallowRef<string>
  pending: boolean
  bytes: number
}

const cache = new Map<string, RenderEntry>()
const queue: Array<() => Promise<void>> = []
const maxEntries = 512
const maxBytes = 32 * 1024 * 1024
let cachedBytes = 0
let running = 0
let engine: Promise<typeof import('~/lib/markdownRenderer')> | undefined

function drain() {
  while (running < 2 && queue.length) {
    const work = queue.shift()!
    running++
    void work().finally(() => { running--; drain() })
  }
}

function prune() {
  for (const [source, entry] of cache) {
    if (cache.size <= 1 || (cache.size <= maxEntries && cachedBytes <= maxBytes)) break
    if (entry.pending) continue
    // 删除索引不修改 ref，已显示的页面不会因缓存淘汰反复重新渲染。
    cache.delete(source)
    cachedBytes -= entry.bytes
  }
}

function resultOf(source: string): RenderEntry {
  const existing = cache.get(source)
  if (existing) {
    cache.delete(source)
    cache.set(source, existing)
    return existing
  }
  const entry: RenderEntry = { html: shallowRef(''), pending: true, bytes: source.length * 2 }
  cache.set(source, entry)
  cachedBytes += entry.bytes
  queue.push(async () => {
    try {
      engine ||= import('~/lib/markdownRenderer')
      const { renderArchiveMarkdown } = await engine
      entry.html.value = await renderArchiveMarkdown(source)
    } catch (error) {
      console.error('[Markdown] 渲染失败', error)
      // 依赖加载失败时保留可阅读的纯文本，不把未过滤的内容交给 v-html。
      const text = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      entry.html.value = '<p role="alert">Markdown 渲染失败，请刷新重试。</p><pre>' + text + '</pre>'
      engine = undefined
    } finally {
      entry.pending = false
      const bytes = entry.html.value.length * 2
      entry.bytes += bytes
      cachedBytes += bytes
      prune()
    }
  })
  drain()
  prune()
  return entry
}

export function useMarkdown() {
  // 发布包依赖浏览器 DOM；首次挂载前保持与 SSR 一致，避免水合内容不匹配。
  const mounted = shallowRef(!getCurrentInstance() && import.meta.client)
  if (getCurrentInstance()) onMounted(() => { mounted.value = true })
  const render = (source: string): string => {
    if (!mounted.value || import.meta.server || !source) return ''
    return resultOf(source).html.value
  }
  return { render }
}
