<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open?: boolean
  position?: 'start' | 'end'
  type?: 'modal' | 'non-modal' | 'inline'
  size?: 'small' | 'medium' | 'large' | 'full'
  title?: string
}>(), { open: false, position: 'start', type: 'modal', size: 'small' })

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const el = ref<any>(null)

function apply(open: boolean) {
  const drawer = el.value
  if (!drawer) return
  try {
    if (open) drawer.show?.()
    else drawer.hide?.()
  } catch { /* 尚未升级 */ }
}
function close() {
  emit('update:open', false)
  apply(false)
}
function onToggle(event: any) {
  const state = event?.newState
  if (state && state !== 'open' && props.open) emit('update:open', false)
}

onMounted(() => { if (props.open) nextTick(() => apply(true)) })
watch(() => props.open, (open) => nextTick(() => apply(open)))
</script>

<template>
  <fluent-drawer
    ref="el"
    class="f-drawer"
    :position="position"
    :type="type"
    :size="size"
    :aria-label="title || '导航'"
    @toggle="onToggle"
  >
    <fluent-drawer-body>
      <h2 slot="title" class="f-drawer__title">{{ title || '导航' }}</h2>
      <fluent-button slot="close" class="f-drawer__close" appearance="subtle" icon-only aria-label="关闭" @click="close">
        <X :size="18" aria-hidden="true" />
      </fluent-button>
      <slot />
      <div v-if="$slots.footer" slot="footer" class="f-drawer__footer">
        <slot name="footer" />
      </div>
    </fluent-drawer-body>
  </fluent-drawer>
</template>

<style scoped>
.f-drawer::part(drawer) { max-width: 92vw; }
.f-drawer__title { margin: 0; font-size: 16px; font-weight: 600; color: var(--colorNeutralForeground1); }
.f-drawer__close { width: 32px; height: 32px; }
</style>
