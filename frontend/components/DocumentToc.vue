<script setup lang="ts">
import { Check, ChevronDown, Copy, ExternalLink, History } from '@lucide/vue'

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
      let id = `doc-heading-${index + 1}`
      while (ids.has(id) || document.getElementById(id)) id += '-h'
      element.id = id
      ids.add(id)
    }
    const label = element.cloneNode(true) as HTMLElement
    label.querySelectorAll('.heading-anchor,.katex-mathml').forEach(el => el.remove())
    return {
      id: element.id,
      text: label.textContent?.trim() || '无标题',
      depth: Math.min(2, Number(element.tagName.slice(1)) - base),
      element,
    }
  })
  if (!headings.value.some(entry => entry.id === activeId.value)) activeId.value = ''
  scheduleActive()
}

watch(() => props.content, (content) => {
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
  window.removeEventListener('scroll', scheduleActive)
  window.removeEventListener('resize', scheduleActive)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <nav
    v-if="headings.length"
    aria-label="文档目录"
    class="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto [scrollbar-width:thin] xl:block"
  >
    <p class="border-b border-border pb-3 text-sm font-semibold tracking-tight">
      目录
    </p>
    <ul class="space-y-0.5 text-[13px]">
      <li v-for="entry in headings" :key="entry.id">
        <a
          :href="`#${entry.id}`"
          class="block truncate rounded-md px-2 py-1 transition-colors"
          :class="[
            entry.depth === 0 ? '' : 'pl-5',
            activeId === entry.id
              ? 'bg-accent font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          ]"
          @click.prevent="activeId = entry.id; entry.element.scrollIntoView({ behavior: 'smooth' })"
        >{{ entry.text }}</a>
      </li>
    </ul>
  </nav>
</template>
