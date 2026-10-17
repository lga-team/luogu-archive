<script setup lang="ts">
import type { Root } from 'react-dom/client'
import type { UserControlsProps } from '../react/user-controls'

const props = defineProps<Omit<UserControlsProps, 'onUpdate' | 'onTab' | 'onFeed' | 'onDiscussion' | 'onAction' | 'onFollow' | 'onCard'>>()
const emit = defineEmits<{ update: []; tab: [tab: string]; feed: [value: boolean]; discussion: [value: boolean]; action: []; follow: []; card: [] }>()
const host = ref<HTMLElement | null>(null)
const failed = ref(false)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false

onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { UserControls }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/user-controls'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    draw = () => root?.render(createElement(UserControls, {
      ...props,
      onUpdate: () => emit('update'),
      onTab: (tab: string) => emit('tab', tab),
      onFeed: (value: boolean) => emit('feed', value),
      onDiscussion: (value: boolean) => emit('discussion', value),
      onAction: () => emit('action'),
      onFollow: () => emit('follow'),
      onCard: () => emit('card'),
    }))
    draw()
  } catch {
    if (!disposed) failed.value = true
  }
})
watch(() => ({ ...props }), () => draw?.(), { deep: true })
onBeforeUnmount(() => { disposed = true; root?.unmount() })
</script>

<template>
  <div ref="host" class="archive-react" />
  <p v-if="failed" role="alert">控件加载失败，请刷新页面重试。</p>
</template>

<style src="../react/archive.css" />
<style src="../react/user.css" />
