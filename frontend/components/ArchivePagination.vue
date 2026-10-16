<script setup lang="ts">
import type { Root } from 'react-dom/client'

const props = defineProps<{
  page: number
  totalPages: number
  pending?: boolean
}>()
const emit = defineEmits<{ page: [page: number] }>()
const host = ref<HTMLElement | null>(null)
const loadFailed = ref(false)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false

onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { Pagination }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/pagination'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    draw = () => root?.render(createElement(Pagination, {
      ...props,
      onPage: (page: number) => emit('page', page),
    }))
    draw()
  } catch {
    if (!disposed) loadFailed.value = true
  }
})
watch(() => ({ ...props }), () => draw?.())
onBeforeUnmount(() => { disposed = true; root?.unmount() })
</script>

<template>
  <div ref="host" class="archive-react" />
  <p v-if="loadFailed" role="alert">分页加载失败，请刷新页面重试。</p>
</template>

<style src="../react/archive.css" />
<style src="../react/pagination.css" />
