<script setup lang="ts">
import { Check, Reply, TriangleAlert } from 'lucide-vue-next'

const props = defineProps<{ content: string; senderName: string | null | undefined }>()
const { copyReply } = useFeedReply()
const state = ref<'idle' | 'ok' | 'err'>('idle')
let timer: ReturnType<typeof setTimeout> | null = null

async function onClick() {
  const ok = await copyReply(props.content, props.senderName || '')
  state.value = ok ? 'ok' : 'err'
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { state.value = 'idle' }, 1500)
}

onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <FButton
    appearance="subtle"
    size="small"
    :title="state === 'ok' ? '已复制回复格式' : state === 'err' ? '复制失败' : '复制为洛谷回复格式'"
    @click="onClick"
  >
    <template #start>
      <Check v-if="state === 'ok'" :size="14" aria-hidden="true" />
      <TriangleAlert v-else-if="state === 'err'" :size="14" aria-hidden="true" />
      <Reply v-else :size="14" aria-hidden="true" />
    </template>
    {{ state === 'ok' ? '已复制' : state === 'err' ? '失败' : '回复' }}
  </FButton>
</template>
