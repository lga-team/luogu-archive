<script setup lang="ts">
withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'left' })

const host = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | undefined

function fit() {
  if (!host.value || !content.value) return
  const width = content.value.scrollWidth
  if (width && host.value.clientWidth) scale.value = Math.min(1, host.value.clientWidth / width)
}

onMounted(() => {
  observer = new ResizeObserver(fit)
  if (host.value) observer.observe(host.value)
  if (content.value) observer.observe(content.value)
  fit()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <span ref="host" class="fit-inline" :data-align="align">
    <span ref="content" class="fit-inline-content" :style="{ transform: `translateY(-50%) scale(${scale})` }"><slot /></span>
  </span>
</template>

<style scoped>
.fit-inline { display: block; position: relative; width: 100%; min-width: 0; height: 20px; }
.fit-inline-content { position: absolute; top: 50%; left: 0; display: inline-flex; align-items: center; gap: 8px; width: max-content; max-width: none; white-space: nowrap; transform-origin: left center; }
.fit-inline[data-align=right] .fit-inline-content { left: auto; right: 0; transform-origin: right center; }
</style>
