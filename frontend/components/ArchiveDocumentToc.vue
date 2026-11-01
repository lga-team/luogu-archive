<script setup lang="ts">
import { List } from 'lucide-vue-next'

interface HeadingEntry { id: string; text: string; depth: number; element: HTMLElement }
const props = defineProps<{ content: HTMLElement | null }>()
const headings = shallowRef<HeadingEntry[]>([])
const activeId = ref('')
let mutations: MutationObserver | undefined
let resize: ResizeObserver | undefined
let frame = 0

function updateActive() {
  frame = 0
  const entries = headings.value
  if (!entries.length) return
  let current = entries[0]
  for (const entry of entries) {
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
  mutations?.disconnect()
  resize?.disconnect()
  headings.value = []
  activeId.value = ''
  if (!content || import.meta.server) return
  collect()
  mutations = new MutationObserver(collect)
  mutations.observe(content, { childList: true, subtree: true, characterData: true })
  resize = new ResizeObserver(scheduleActive)
  resize.observe(content)
}, { immediate: true, flush: 'post' })
onMounted(() => {
  window.addEventListener('scroll', scheduleActive, { passive: true })
  window.addEventListener('resize', scheduleActive)
})
onBeforeUnmount(() => {
  mutations?.disconnect()
  resize?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleActive)
  window.removeEventListener('resize', scheduleActive)
})
</script>

<template>
  <nav v-if="headings.length" class="doc-toc" aria-label="本页目录">
    <h2 class="doc-toc__title"><List :size="16" aria-hidden="true" />本页目录</h2>
    <ol class="doc-toc__list">
      <li v-for="heading in headings" :key="heading.id">
        <a
          :href="'#' + encodeURIComponent(heading.id)"
          class="doc-toc__link"
          :class="'level-' + Math.min(4, heading.depth + 2)"
          :aria-current="activeId === heading.id ? 'location' : undefined"
          @click="openHeading(heading)"
        >{{ heading.text }}</a>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.doc-toc { padding: 14px; }
.doc-toc__title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--colorNeutralForeground2); }
.doc-toc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.doc-toc__link {
  display: block; padding: 4px 8px; border-left: 2px solid transparent;
  border-radius: 0 var(--borderRadiusSmall) var(--borderRadiusSmall) 0;
  color: var(--colorNeutralForeground3); font-size: 12px; line-height: 1.5;
  text-decoration: none; overflow-wrap: anywhere;
}
.doc-toc__link:hover { color: var(--colorNeutralForeground1); background: var(--colorNeutralBackground1Hover); text-decoration: none; }
.doc-toc__link[aria-current="location"] { color: var(--colorBrandForeground1); border-left-color: var(--colorBrandStroke1); font-weight: 600; }
</style>
