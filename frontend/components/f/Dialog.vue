<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  type?: 'modal' | 'non-modal' | 'alert'
  size?: 'small' | 'medium' | 'large' | 'full'
}>(), { open: false, type: 'modal', size: 'medium' })

const emit = defineEmits<{ 'update:open': [value: boolean]; close: [] }>()
const el = ref<any>(null)

function apply(open: boolean) {
  const dialog = el.value
  if (!dialog) return
  try {
    if (open) dialog.show?.()
    else dialog.hide?.()
  } catch { /* 对话框尚未完成升级时忽略 */ }
}

function close() {
  emit('update:open', false)
  emit('close')
  apply(false)
}

function onToggle(event: any) {
  const state = event?.newState
  const isOpen = state ? state === 'open' : true
  if (!isOpen && props.open) {
    emit('update:open', false)
    emit('close')
  }
}

onMounted(() => { if (props.open) nextTick(() => apply(true)) })
watch(() => props.open, (open) => nextTick(() => apply(open)))
</script>

<template>
  <fluent-dialog
    ref="el"
    class="f-dialog"
    :class="'f-dialog--' + size"
    :type="type"
    :aria-label="title || '对话框'"
    @toggle="onToggle"
  >
    <fluent-dialog-body>
      <h2 v-if="title || $slots.title" slot="title" class="app-dialog__title">
        <slot name="title">{{ title }}</slot>
      </h2>
      <fluent-button
        slot="close"
        appearance="transparent"
        icon-only
        aria-label="关闭"
        @click="close"
      >
        <X :size="18" aria-hidden="true" />
      </fluent-button>
      <div class="app-dialog__body">
        <slot />
      </div>
      <div v-if="$slots.actions" slot="action" class="app-dialog__actions">
        <slot name="actions" />
      </div>
    </fluent-dialog-body>
  </fluent-dialog>
</template>

<style scoped>
.f-dialog::part(dialog) { width: min(100%, 600px); max-width: 600px; max-height: min(88dvh, 900px); }
.f-dialog--small::part(dialog) { width: min(100%, 420px); max-width: 420px; }
.f-dialog--large::part(dialog) { width: min(100%, 960px); max-width: 960px; }
.f-dialog--full::part(dialog) { width: calc(100vw - 24px); max-width: none; }
</style>
