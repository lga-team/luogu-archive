<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { X } from 'lucide-vue-next'
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  open: boolean
  title: string
  description: string
  contentClass?: string
  overlayClass?: string
  titleClass?: string
  descriptionClass?: string
  locked?: boolean
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; closeAutoFocus: [event: Event] }>()
const previousFocus = shallowRef<HTMLElement | null>(null)
function captureFocus() {
  previousFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
}
function restoreFocus(event: Event) {
  emit('closeAutoFocus', event)
  // 无 Trigger 的受控弹窗也应回到打开它的按钮；页面跳转时不抢焦点。
  if (!event.defaultPrevented && previousFocus.value?.isConnected) {
    event.preventDefault()
    previousFocus.value.focus()
  }
}
function changeOpen(value: boolean) { if (!props.locked) emit('update:open', value) }
</script>
<template>
  <DialogRoot :open="open" @update:open="changeOpen">
    <DialogPortal>
      <DialogOverlay :class="['archive-dialog-overlay', overlayClass]" />
      <DialogContent v-bind="$attrs" :class="['archive-ui archive-dialog-content', contentClass]"
        @open-auto-focus="captureFocus" @close-auto-focus="restoreFocus"
        @escape-key-down="locked && $event.preventDefault()" @pointer-down-outside="locked && $event.preventDefault()">
        <div class="archive-dialog-header">
          <DialogTitle :class="['archive-dialog-title', titleClass]"><slot name="title">{{ title }}</slot></DialogTitle>
          <DialogDescription :class="['archive-dialog-description', descriptionClass]">{{ description }}</DialogDescription>
        </div>
        <slot />
        <div v-if="$slots.footer" class="archive-dialog-footer"><slot name="footer" /></div>
        <DialogClose class="archive-dialog-close" aria-label="关闭" title="关闭" :disabled="locked"><X :size="16" aria-hidden="true" /></DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
