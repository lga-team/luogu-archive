<script setup lang="ts">
import { List } from 'lucide-vue-next'

interface HeadingEntry { id: string; text: string; depth: number; element: HTMLElement }
const props = defineProps<{ content: HTMLElement | null }>()
const headings = shallowRef<HeadingEntry[]>([])
const activeId = ref('')
const navigation = shallowRef<HTMLElement | null>(null)
const list = shallowRef<HTMLOListElement | null>(null)
const marker = shallowRef({ top: 0, height: 0 })
const markerReady = ref(false)
const markerStyle = computed(() => ({
  '--toc-marker-y': `${marker.value.top}px`,
  '--toc-marker-height': `${marker.value.height}px`,
}))
let mutations: MutationObserver | undefined
let resize: ResizeObserver | undefined
let frame = 0
let scrolling: HTMLElement | undefined

function stopFollowing() {
  if (!scrolling) return
  scrolling.scrollTo({ top: scrolling.scrollTop, behavior: 'auto' })
  scrolling = undefined
}
function updateMarker() {
  const link = list.value?.querySelector<HTMLElement>('a[aria-current="location"]')
  if (!link?.getClientRects().length || !list.value) return
  const item = link.getBoundingClientRect()
  const bounds = list.value.getBoundingClientRect()
  // 首次定位不从列表顶端飞入，后续章节切换才使用过渡。
  markerReady.value = marker.value.height > 0
  marker.value = { top: item.top - bounds.top, height: item.height }
}
function keepActiveVisible() {
  // 取消上一目标，即使新的章节已经可见，也不能让旧滚动继续把它带走。
  stopFollowing()
  const link = navigation.value?.querySelector<HTMLElement>('a[aria-current="location"]')
  if (!link?.getClientRects().length) return
  let scroller: HTMLElement | null = navigation.value
  // 插件页由外侧信息栏滚动，文章页则是目录本身；不滚动正文或窗口。
  while (scroller && scroller !== document.body && scroller !== document.documentElement) {
    if (/^(auto|scroll)$/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight) break
    scroller = scroller.parentElement
  }
  if (!scroller || scroller === document.body || scroller === document.documentElement) return
  const bounds = scroller.getBoundingClientRect()
  const top = Math.max(0, bounds.top + scroller.clientTop) + 8
  const bottom = Math.min(window.innerHeight, bounds.top + scroller.clientTop + scroller.clientHeight) - 8
  if (bottom <= top) return
  const item = link.getBoundingClientRect()
  let target = scroller.scrollTop
  if (item.bottom > bottom) target += item.bottom - bottom
  else if (item.top < top) target -= top - item.top
  else return
  scrolling = scroller
  scroller.scrollTo({
    top: target,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
watch([activeId, headings], () => {
  updateMarker()
  keepActiveVisible()
}, { flush: 'post' })

function updateActive() {
  frame = 0
  const entries = headings.value
  if (!entries.length) return
  let current = entries[0]
  for (const entry of entries) {
    // 收起的折叠框内标题仍在目录中，但不参与当前阅读位置计算。
    if (!entry.element.getClientRects().length) continue
    if (entry.element.getBoundingClientRect().top <= 100) current = entry
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = [...entries].reverse().find(entry => entry.element.getClientRects().length > 0) || current
  }
  activeId.value = current.id
}
function scheduleActive() {
  if (!frame) frame = requestAnimationFrame(updateActive)
}
function updateViewport() {
  scheduleActive()
  nextTick(() => { updateMarker(); keepActiveVisible() })
}
function collect() {
  const elements = Array.from(props.content?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6') || [])
  const base = elements.length ? Math.min(...elements.map(el => Number(el.tagName.slice(1)))) : 1
  const ids = new Set(elements.map(el => el.id).filter(Boolean))
  headings.value = elements.map((element, index) => {
    if (!element.id) {
      let id = `archive-document-heading-${index + 1}`
      while (ids.has(id) || document.getElementById(id)) id += '-heading'
      element.id = id
      ids.add(id)
    }
    const label = element.cloneNode(true) as HTMLElement
    label.querySelectorAll('.heading-anchor,.katex-mathml').forEach(el => el.remove())
    return {
      id: element.id,
      text: label.textContent?.trim() || '无标题',
      depth: Math.min(3, Number(element.tagName.slice(1)) - base),
      element,
    }
  })
  if (!headings.value.some(entry => entry.id === activeId.value)) activeId.value = ''
  scheduleActive()
}
function openHeading(entry: HeadingEntry) {
  let parent = entry.element.closest('details')
  while (parent) {
    parent.open = true
    parent = parent.parentElement?.closest('details') || null
  }
  activeId.value = entry.id
}
watch(() => props.content, content => {
  stopFollowing()
  mutations?.disconnect()
  resize?.disconnect()
  headings.value = []
  activeId.value = ''
  marker.value = { top: 0, height: 0 }
  markerReady.value = false
  if (!content || import.meta.server) return
  collect()
  mutations = new MutationObserver(collect)
  mutations.observe(content, { childList: true, subtree: true, characterData: true })
  resize = new ResizeObserver(() => {
    scheduleActive()
    nextTick(updateMarker)
  })
  resize.observe(content)
}, { immediate: true, flush: 'post' })
onMounted(() => {
  window.addEventListener('scroll', scheduleActive, { passive: true })
  window.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => {
  stopFollowing()
  mutations?.disconnect()
  resize?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleActive)
  window.removeEventListener('resize', updateViewport)
})
</script>

<template>
  <nav v-if="headings.length" ref="navigation" class="document-toc-nav archive-card" aria-label="本页目录">
    <h2><List :size="18" aria-hidden="true" />本页目录</h2>
    <ol ref="list" :class="{ 'animate-marker': markerReady }" :style="markerStyle">
      <li v-for="heading in headings" :key="heading.id">
        <a :href="'#' + encodeURIComponent(heading.id)" :style="{ paddingLeft: (16 + heading.depth * 12) + 'px' }"
          :aria-current="activeId === heading.id ? 'location' : undefined" @click="openHeading(heading)">{{ heading.text }}</a>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.document-toc-nav { display: block; padding: 20px; max-height: calc(100vh - 36px); overflow-y: auto; scrollbar-width: thin; }
.document-toc-nav h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 16px; color: var(--text); font-size: 15px; font-weight: 600; line-height: 1.6; }
.document-toc-nav h2 > svg { flex-shrink: 0; color: var(--text-muted); }
.document-toc-nav ol { position: relative; list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--border); }
.document-toc-nav ol::before { content: ''; position: absolute; top: 0; left: -1px; width: 2px; height: var(--toc-marker-height, 0px); transform: translateY(var(--toc-marker-y, 0px)); background: var(--link); pointer-events: none; }
.document-toc-nav ol.animate-marker::before { transition: transform 200ms cubic-bezier(.16, 1, .3, 1), height 200ms cubic-bezier(.16, 1, .3, 1); }
.document-toc-nav a { display: block; margin-left: -1px; border-left: 2px solid transparent; padding: 5px 8px 5px 16px; color: var(--text-muted); font-size: 13px; line-height: 1.7; text-decoration: none; overflow-wrap: anywhere; transition: color 160ms ease; }
.document-toc-nav a:hover { color: var(--text); }
.document-toc-nav a[aria-current=location] { color: var(--link); }
.document-toc-nav a:focus-visible { outline: 2px solid var(--link); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .document-toc-nav ol.animate-marker::before, .document-toc-nav a { transition: none; } }
</style>
