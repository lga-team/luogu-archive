<script setup lang="ts">
import type { Root } from 'react-dom/client'
import type { DiscussionForum } from '../react/discussion-controls'

const props = defineProps<{
  mode: 'header' | 'forums' | 'pagination' | 'retry' | 'detail-header' | 'detail-toolbar' | 'copy'
  state?: string
  message?: string
  updatedAt?: string
  forums?: DiscussionForum[]
  selectedForum?: string
  page?: number
  totalPages?: number
  pending?: boolean
  title?: string
  forumName?: string
  discussionId?: number
  copied?: boolean
  copyDisabled?: boolean
}>()
const emit = defineEmits<{ update: []; forum: [slug: string]; page: [page: number]; retry: []; copy: []; back: [] }>()
const host = ref<HTMLElement | null>(null)
const loadFailed = ref(false)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false

onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { DiscussionControls }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/discussion-controls'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    draw = () => root?.render(createElement(DiscussionControls, {
      ...props,
      onUpdate: () => emit('update'),
      onForum: (slug: string) => emit('forum', slug),
      onPage: (page: number) => emit('page', page),
      onRetry: () => emit('retry'),
      onCopy: () => emit('copy'),
      onBack: () => emit('back'),
    }))
    draw()
  } catch {
    if (!disposed) loadFailed.value = true
  }
})
watch(() => ({ ...props }), () => draw?.(), { deep: true })
onBeforeUnmount(() => { disposed = true; root?.unmount() })
</script>

<template>
  <div ref="host" class="archive-react">
    <h1 v-if="mode === 'detail-header'" class="discussion-post-title">{{ title || `讨论 #${discussionId}` }}</h1>
    <div v-else-if="mode === 'header'" class="archive-card judgement-heading">
      <div class="archive-card-header judgement-heading-main">
        <div class="judgement-heading-copy"><h1>讨论区</h1><p class="archive-card-description">洛谷讨论主帖与回复归档</p></div>
      </div>
    </div>
  </div>
  <p v-if="loadFailed" role="alert">控件加载失败，请刷新页面重试。</p>
</template>

<style src="../react/archive.css" />
<style src="../react/discussion.css" />
