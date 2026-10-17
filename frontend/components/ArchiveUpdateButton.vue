<script setup lang="ts">
import { CircleCheck, CircleX, RefreshCw, X } from 'lucide-vue-next'
import { Button, Dialog } from './ui'
const props = withDefaults(defineProps<{ state: string; message?: string; disabled?: boolean }>(), { message: '', disabled: false })
const emit = defineEmits<{ update: [] }>()
const feedback = ref<'idle' | 'success' | 'failed'>('idle')
const result = ref<'success' | 'failed'>('success')
const label = ref('派发')
const errorOpen = ref(false)
const failureReason = ref('')
const updateButton = ref<InstanceType<typeof Button> | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
const pending = computed(() => props.state === 'pending')
const buttonState = computed(() => pending.value ? 'pending' : feedback.value)
const accessibleLabel = computed(() => pending.value ? '正在提交更新' : feedback.value === 'success' ? (label.value === '合并' ? '已合并到进行中的任务' : '任务已派发') : feedback.value === 'failed' ? '更新失败' : '更新')
watch(() => [props.state, props.message], () => {
  if (import.meta.server) return
  if (pending.value) { clearTimeout(timer); feedback.value = 'idle'; return }
  if (!['success', 'failed', 'cooldown'].includes(props.state)) return
  result.value = props.state === 'success' ? 'success' : 'failed'
  feedback.value = result.value
  label.value = props.message.includes('合并') ? '合并' : '派发'
  if (result.value === 'failed') { failureReason.value = props.message || '更新请求未能提交，请稍后重试。'; errorOpen.value = true }
  clearTimeout(timer)
  timer = setTimeout(() => { feedback.value = 'idle' }, 2000)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
function restoreFocus(event: Event) {
  event.preventDefault()
  const element = updateButton.value?.$el
  if (element instanceof HTMLElement && element.isConnected) element.focus()
}
</script>
<template>
  <Button ref="updateButton" variant="outline" size="sm" class="archive-update" :data-feedback="buttonState"
    :disabled="pending || disabled" :aria-disabled="pending || disabled || feedback !== 'idle'" :aria-busy="pending" :aria-label="accessibleLabel"
    @click="!pending && !disabled && feedback === 'idle' && emit('update')">
    <span class="archive-update-label" aria-hidden="true"><RefreshCw :class="pending ? 'archive-update-spin' : undefined" :size="14" />更新</span>
    <span class="archive-update-result" aria-hidden="true"><template v-if="result === 'success'"><CircleCheck :size="14" :stroke-width="1.75" />{{ label }}</template><template v-else><CircleX :size="14" :stroke-width="1.75" />失败</template></span>
  </Button>
  <span class="archive-update-announcement" role="status">{{ buttonState === 'success' ? message : buttonState === 'failed' ? '更新失败' : '' }}</span>
  <Dialog v-model:open="errorOpen" title="更新失败" :description="failureReason"
    content-class="archive-update-dialog" overlay-class="archive-update-overlay"
    title-class="archive-update-failure-title" description-class="archive-update-failure-reason" @close-auto-focus="restoreFocus">
    <template #title><span class="archive-update-failure-icon"><X :size="20" aria-hidden="true" /></span>更新失败</template>
    <template #footer><Button variant="outline" size="sm" class="archive-update-confirm" @click="errorOpen = false">知道了</Button></template>
  </Dialog>
</template>
<style src="~/assets/css/update-button.css" />
