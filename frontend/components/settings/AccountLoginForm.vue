<script setup lang="ts">
import { Eye, EyeOff, LoaderCircle } from 'lucide-vue-next'
import { Button, Input, Label } from '../ui'
const props = defineProps<{ login: (data: { email: string; password: string }) => Promise<void> }>()
const api = useApi()
const email = ref('')
const password = ref('')
const visible = ref(false)
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
  pending.value = true; error.value = ''; needVerify.value = false; message.value = ''
  try { await props.login({ email: email.value, password: password.value }) }
  catch (reason: any) {
    if (!disposed) { error.value = reason?.data?.message || '登录失败'; needVerify.value = error.value.includes('验证邮箱') }
  } finally { if (!disposed) pending.value = false }
}
async function sendVerification() {
  if (sending.value || cooldown.value) return
  if (!email.value) { message.value = '请先填写邮箱'; return }
  sending.value = true; message.value = ''
  try {
    const data = await api<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email: email.value } })
    if (!disposed) { message.value = data.message || '已发送，请查收'; startCooldown(60) }
  } catch (reason: any) {
    if (!disposed) {
      message.value = reason?.data?.message || '发送失败'
      const retry = reason?.data?.data?.retry_after_sec
      if (typeof retry === 'number' && retry > 0) startCooldown(Math.ceil(retry))
    }
  } finally { if (!disposed) sending.value = false }
}
</script>
<template>
  <div class="settings-login">
    <form class="settings-form" @submit.prevent="submit">
      <div class="settings-field"><Label for="settings-email">邮箱</Label><Input id="settings-email" v-model="email" type="email" autocomplete="email" placeholder="name@example.com" required /></div>
      <div class="settings-field"><Label for="settings-password">密码</Label><div class="settings-password"><Input id="settings-password" v-model="password" :type="visible ? 'text' : 'password'" autocomplete="current-password" required /><Button size="icon" variant="ghost" :aria-label="visible ? '隐藏密码' : '显示密码'" :title="visible ? '隐藏密码' : '显示密码'" :aria-pressed="visible" @click="visible = !visible"><component :is="visible ? EyeOff : Eye" :size="16" /></Button></div></div>
      <p v-if="error" class="archive-error settings-message" role="alert">{{ error }}</p>
      <Button type="submit" :disabled="pending" class="settings-submit"><LoaderCircle v-if="pending" class="settings-spin" :size="16" aria-hidden="true" />{{ pending ? '登录中…' : '登录' }}</Button>
    </form>
    <div v-if="needVerify" class="settings-verification"><Button variant="outline" :disabled="sending || cooldown > 0" @click="sendVerification">{{ sending ? '正在发送…' : cooldown ? '重新发送（' + cooldown + 's）' : '重新发送验证邮件' }}</Button><p v-if="message" class="settings-message archive-muted" role="status">{{ message }}</p></div>
    <div class="settings-register"><span>还没有账号？</span><Button as-child variant="ghost"><NuxtLink to="/register">创建账号</NuxtLink></Button></div>
  </div>
</template>
