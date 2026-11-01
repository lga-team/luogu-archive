<script setup lang="ts">
import { Check, RefreshCw, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  state: string
  message?: string
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
}>(), {
  message: '',
  disabled: false,
  size: 'medium',
})
const emit = defineEmits<{ update: [] }>()
const feedback = ref<'idle' | 'success' | 'failed'>('idle')
const errorOpen = ref(false)
const failureReason = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

const pending = computed(() => props.state === 'pending')
const buttonState = computed(() => pending.value ? 'pending' : feedback.value)
const accessibleLabel = computed(() => pending.value
  ? '正在提交更新'
  : feedback.value === 'success'
    ? (props.message.includes('合并') ? '已合并到进行中的任务' : '任务已派发')
    : feedback.value === 'failed' ? '更新失败' : '更新')

watch(() => [props.state, props.message], () => {
  if (import.meta.server) return
  if (pending.value) { clearTimeout(timer); feedback.value = 'idle'; return }
  if (!['success', 'failed', 'cooldown'].includes(props.state)) return
  feedback.value = props.state === 'success' ? 'success' : 'failed'
  if (feedback.value === 'failed') {
    failureReason.value = props.message || '更新请求未能提交，请稍后重试。'
    errorOpen.value = true
  }
  clearTimeout(timer)
  timer = setTimeout(() => { feedback.value = 'idle' }, 2200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <FButton
    appearance="outline"
    :size="size"
    :disabled="pending || disabled"
    :aria-busy="pending"
    :aria-label="accessibleLabel"
    @click="!pending && !disabled && feedback === 'idle' && emit('update')"
  >
    <template #start>
      <Check v-if="buttonState === 'success'" :size="14" aria-hidden="true" />
      <X v-else-if="buttonState === 'failed'" :size="14" aria-hidden="true" />
      <RefreshCw v-else :size="14" :class="{ spin: pending }" aria-hidden="true" />
    </template>
    {{ buttonState === 'success' ? (message.includes('合并') ? '已合并' : '已派发') : buttonState === 'failed' ? '更新失败' : '更新' }}
  </FButton>
  <span class="sr-only" role="status">{{ buttonState === 'success' ? message : buttonState === 'failed' ? '更新失败' : '' }}</span>

  <FDialog :open="errorOpen" title="更新失败" @update:open="errorOpen = $event">
    <div class="stack">
      <div class="notice notice--warn"><X :size="18" aria-hidden="true" /><span>{{ failureReason }}</span></div>
    </div>
    <template #actions>
      <FButton appearance="outline" @click="errorOpen = false">知道了</FButton>
    </template>
  </FDialog>
</template>

<style scoped>
.spin { animation: update-spin 1s linear infinite; }
@keyframes update-spin { to { transform: rotate(360deg); } }
</style>
