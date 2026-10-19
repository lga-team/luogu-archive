<script setup lang="ts">
import { CircleAlert, CircleCheck, Loader2 } from '@lucide/vue'

// 一键保存 / 更新按钮。封装 POST /save，并在需要时弹出人机验证。
const props = defineProps<{
  contentType: string
  contentId: string
}>()

const state = ref<'idle' | 'pending' | 'success' | 'failed' | 'cooldown' | 'captcha'>('idle')
const message = ref<string>('')
const captchaToken = ref<string>('')
const showCaptcha = ref(false)
const captchaRef = ref<any>(null)

const api = useApi()

const stateClass = computed(() => {
  if (state.value === 'success') return 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
  if (state.value === 'failed') return 'border-destructive/40 text-destructive'
  if (state.value === 'cooldown' || state.value === 'captcha') return 'border-amber-500/40 text-amber-600 dark:text-amber-400'
  return ''
})

async function save() {
  if (state.value === 'pending') return
  state.value = 'pending'
  message.value = '排队中...'
  try {
    const resp = await api<{ task_id: string; merged: boolean; status: string }>(
      '/save',
      {
        method: 'POST',
        body: {
          content_type: props.contentType,
          id: props.contentId,
          captcha_token: captchaToken.value || undefined,
        },
      },
    )
    showCaptcha.value = false
    captchaToken.value = ''
    captchaRef.value?.reset?.()
    state.value = 'success'
    message.value = resp.merged ? '已合并到进行中的任务' : '已派发，请稍后刷新'
    setTimeout(() => { state.value = 'idle'; message.value = '' }, 3000)
  } catch (e: any) {
    const code = e?.data?.error_code
    if (code === 'captcha_required') {
      state.value = 'captcha'
      showCaptcha.value = true
      message.value = '请完成人机验证'
      await nextTick()
      try {
        captchaToken.value = await captchaRef.value?.getToken?.()
        await save()
      } catch (err: any) {
        message.value = err?.message || '请先完成人机验证'
      }
    } else if (code === 'rate_limited') {
      state.value = 'cooldown'
      const s = e?.data?.data?.retry_after_sec || 30
      message.value = `冷却中 ${s}s`
      setTimeout(() => { state.value = 'idle' }, s * 1000)
    } else {
      state.value = 'failed'
      message.value = e?.data?.message || '失败'
      setTimeout(() => { state.value = 'idle' }, 3000)
    }
  }
}

async function onCaptchaVerified(token: string) {
  if (state.value !== 'captcha') return
  captchaToken.value = token
  await save()
}
</script>

<template>
  <div class="grid gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      :class="stateClass"
      :disabled="state === 'pending'"
      @click="save"
    >
      <Loader2 v-if="state === 'pending'" class="size-3.5 animate-spin" />
      <CircleCheck v-else-if="state === 'success'" class="size-3.5" />
      <CircleAlert v-else-if="state === 'failed'" class="size-3.5" />
      <span v-if="state === 'idle'">立即更新</span>
      <span v-else>{{ message }}</span>
    </Button>

    <CaptchaChallenge
      v-if="showCaptcha"
      ref="captchaRef"
      :id-suffix="`save-${contentType}-${contentId}`"
      @verified="onCaptchaVerified"
    />
  </div>
</template>
