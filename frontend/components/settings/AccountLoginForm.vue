<script setup lang="ts">
import { LoaderCircle, LogIn } from 'lucide-vue-next'

const props = defineProps<{ login: (data: { email: string; password: string }) => Promise<void> }>()
const api = useApi()
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')
const needVerify = ref(false)
const sending = ref(false)
const message = ref('')
const cooldown = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false

function startCooldown(seconds: number) {
  cooldown.value = seconds
  clearTimeout(timer)
  const tick = () => {
    cooldown.value = Math.max(0, cooldown.value - 1)
    if (cooldown.value) timer = setTimeout(tick, 1000)
  }
  if (seconds) timer = setTimeout(tick, 1000)
}

onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })

async function submit() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  needVerify.value = false
  message.value = ''
  try {
    await props.login({ email: email.value, password: password.value })
  } catch (reason: any) {
    if (!disposed) {
      error.value = reason?.data?.message || '登录失败'
      needVerify.value = error.value.includes('验证邮箱')
    }
  } finally {
    if (!disposed) pending.value = false
  }
}

async function sendVerification() {
  if (sending.value || cooldown.value) return
  if (!email.value) { message.value = '请先填写邮箱'; return }
  sending.value = true
  message.value = ''
  try {
    const data = await api<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email: email.value } })
    if (!disposed) { message.value = data.message || '已发送，请查收'; startCooldown(60) }
  } catch (reason: any) {
    if (!disposed) {
      message.value = reason?.data?.message || '发送失败'
      const retry = reason?.data?.data?.retry_after_sec
      if (typeof retry === 'number' && retry > 0) startCooldown(Math.ceil(retry))
    }
  } finally {
    if (!disposed) sending.value = false
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <div class="stack stack--xs">
      <label for="login-email" class="field-label">邮箱</label>
      <FInput
        id="login-email"
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="name@example.com"
        required
        aria-label="邮箱"
      />
    </div>
    <div class="stack stack--xs">
      <label for="login-password" class="field-label">密码</label>
      <FInput
        id="login-password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        aria-label="密码"
        @enter="submit"
      />
    </div>

    <div v-if="error" class="notice notice--warn" role="alert">
      <span>{{ error }}</span>
    </div>

    <FButton type="submit" appearance="primary" size="large" block :loading="pending">
      <template #start><LogIn v-if="!pending" :size="17" aria-hidden="true" /></template>
      {{ pending ? '登录中…' : '登录' }}
    </FButton>

    <div v-if="needVerify" class="stack stack--sm">
      <FButton appearance="outline" :disabled="sending || cooldown > 0" @click="sendVerification">
        <template #start><LoaderCircle v-if="sending" :size="15" class="spin" aria-hidden="true" /></template>
        {{ sending ? '正在发送…' : cooldown ? '重新发送（' + cooldown + 's）' : '重新发送验证邮件' }}
      </FButton>
      <p v-if="message" class="field-help" role="status">{{ message }}</p>
    </div>
  </form>
</template>

<style scoped>
.spin { animation: login-spin 1s linear infinite; }
@keyframes login-spin { to { transform: rotate(360deg); } }
</style>
