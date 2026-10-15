<script setup lang="ts">
import type { Root } from 'react-dom/client'

const props = defineProps<{ state: string; message: string; updatedAt: string }>()
const emit = defineEmits<{ update: []; ready: []; error: [] }>()
const host = ref<HTMLElement | null>(null)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false

onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { JudgementHeader }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/judgement-header'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    const onReady = () => emit('ready')
    draw = () => root?.render(createElement(JudgementHeader, {
      state: props.state,
      message: props.message,
      updatedAt: props.updatedAt,
      onUpdate: () => emit('update'),
      onReady,
    }))
    draw()
  } catch {
    if (!disposed) emit('error')
  }
})
watch(() => [props.state, props.message, props.updatedAt], () => draw?.())
onBeforeUnmount(() => {
  disposed = true
  root?.unmount()
})
</script>

<template>
  <div ref="host" class="archive-react">
    <div class="archive-card judgement-heading" aria-busy="true">
      <div class="archive-card-header judgement-heading-main">
        <div class="judgement-heading-copy">
          <h1>陶片放逐</h1>
          <p class="archive-card-description">洛谷社区用户权限变更记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="../react/archive.css" />
