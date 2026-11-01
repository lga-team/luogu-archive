<script setup lang="ts">
// 一键保存 / 更新按钮。封装 POST /save，并在需要时弹出人机验证。
const props = defineProps<{ contentType: string; contentId: string }>()

const state = ref<'idle' | 'pending' | 'success' | 'failed' | 'cooldown' | 'captcha'>('idle')
const message = ref<string>('')
const captchaToken = ref<string>('')
const showCaptcha = ref(false)
const captchaRef = ref<any>(null)
const api = useApi()
let resetTimer: ReturnType<typeof setTimeout> | undefined

function clearResetTimer() {
  if (resetTimer !== undefined) clearTimeout(resetTimer)
  resetTimer = undefined
}
function resetAfter(delay: number) {
  clearResetTimer()
  resetTimer = setTimeout(() => {
    resetTimer = undefined
    state.value = 'idle'
    message.value = ''
  }, delay)
}
onBeforeUnmount(clearResetTimer)

async function save() {
  if (state.value === 'pending') return
  clearResetTimer()
  state.value = 'pending'
  message.value = '排队中…'
  try {
    const resp = await api<{ task_id: string; merged: boolean; status: string }>('/save', {
      method: 'POST',
      body: {
        content_type: props.contentType,
        id: props.contentId,
        captcha_token: captchaToken.value || undefined,
      },
    })
    showCaptcha.value = false
    captchaToken.value = ''
    captchaRef.value?.reset?.()
    state.value = 'success'
    message.value = resp.merged ? '已合并到进行中的任务' : '已派发，请稍后刷新'
    resetAfter(3000)
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
      resetAfter(s * 1000)
    } else {
      state.value = 'failed'
      message.value = e?.data?.message || '失败'
      resetAfter(3000)
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
  <div class="save-action">
    <slot :state="state" :message="message" :save="save">
      <FButton
        :appearance="state === 'idle' ? 'primary' : 'outline'"
        size="small"
        :loading="state === 'pending'"
        :disabled="state === 'captcha'"
        @click="save"
      >
        {{ state === 'idle' ? '立即更新' : message || '处理中…' }}
      </FButton>
    </slot>
    <CaptchaChallenge
      v-if="showCaptcha"
      ref="captchaRef"
      :id-suffix="`save-${contentType}-${contentId}`"
      @verified="onCaptchaVerified"
    />
  </div>
</template>

<style scoped>
.save-action { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 0; }
.save-action > .captcha-challenge { margin-top: 8px; }
</style>
