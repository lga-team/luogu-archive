<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { Button, Input, Label } from '../ui'

const api = useApi()
const form = ref({ email: '', password: '', display_name: '' })
const passwordConfirm = ref('')
const state = ref<'idle' | 'loading' | 'done'>('idle')
const error = ref('')
const captchaRef = shallowRef<{ getToken: () => Promise<string | null>; reset: () => void } | null>(null)

async function submit() {
  if (state.value !== 'idle') return
  error.value = ''
  if (form.value.password !== passwordConfirm.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  state.value = 'loading'
  try {
    const captchaToken = await captchaRef.value?.getToken()
    await api('/auth/register', {
      method: 'POST',
      body: { ...form.value, captcha_token: captchaToken || undefined },
    })
    state.value = 'done'
  } catch (reason) {
    const message = (reason as { data?: { message?: unknown } })?.data?.message
    error.value = typeof message === 'string' ? message : '注册失败'
    captchaRef.value?.reset()
    state.value = 'idle'
  }
}
</script>

<template>
  <div class="settings-login">
    <form v-if="state !== 'done'" class="settings-form" @submit.prevent="submit">
      <div class="settings-field"><Label for="register-email">邮箱</Label><Input id="register-email" v-model="form.email" type="email" autocomplete="email" required /></div>
      <div class="settings-field"><Label for="register-name">显示名（1-16 字）</Label><Input id="register-name" v-model="form.display_name" autocomplete="nickname" minlength="1" maxlength="16" required /></div>
      <div class="settings-field"><Label for="register-password">密码（至少 8 位，含字母和数字）</Label><Input id="register-password" v-model="form.password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></div>
      <div class="settings-field"><Label for="register-password-confirm">确认密码</Label><Input id="register-password-confirm" v-model="passwordConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></div>
      <CaptchaChallenge ref="captchaRef" id-suffix="register" />
      <p v-if="error" class="archive-error settings-message" role="alert">{{ error }}</p>
      <Button class="settings-submit" :disabled="state === 'loading'" type="submit"><LoaderCircle v-if="state === 'loading'" class="settings-spin" :size="16" aria-hidden="true" />{{ state === 'loading' ? '注册中…' : '注册' }}</Button>
    </form>
    <div v-else role="status">
      <h3>已发送验证邮件</h3>
      <p>请到 {{ form.email }} 的邮箱查收，24 小时内点击验证链接即可登录。</p>
    </div>
    <div class="settings-register"><span>已有账号？</span><slot /></div>
  </div>
</template>
