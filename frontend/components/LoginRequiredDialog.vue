<script setup lang="ts">
import type { Root } from 'react-dom/client'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; login: [] }>()
const host = ref<HTMLElement | null>(null)
let root: Root | undefined
let draw: (() => void) | undefined
let disposed = false

onMounted(async () => {
  const [{ createRoot }, { createElement }, { LoginRequiredDialog }] = await Promise.all([
    import('react-dom/client'), import('react'), import('../react/login-required-dialog'),
  ])
  if (disposed || !host.value) return
  root = createRoot(host.value)
  draw = () => root?.render(createElement(LoginRequiredDialog, {
    open: props.open,
    onClose: () => emit('close'),
    onLogin: () => emit('login'),
  }))
  draw()
})
watch(() => props.open, () => draw?.())
onBeforeUnmount(() => { disposed = true; root?.unmount() })
</script>

<template>
  <div ref="host" class="archive-react" />
</template>

<style src="../react/archive.css" />
<style src="../react/login-required-dialog.css" />
