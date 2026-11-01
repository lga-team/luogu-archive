<script setup lang="ts">
import { MailCheck, UserPlus } from 'lucide-vue-next'

const form = ref({ email: '', password: '', display_name: '' })
const passwordConfirm = ref('')
const state = ref<'idle' | 'loading' | 'done'>('idle')
const err = ref('')
const captchaRef = ref<any>(null)
const api = useApi()

async function submit() {
  err.value = ''
  if (form.value.password !== passwordConfirm.value) {
    err.value = '两次输入的密码不一致'
    return
  }
  state.value = 'loading'
  try {
    const captchaToken = await captchaRef.value?.getToken?.()
    await api('/auth/register', {
      method: 'POST',
      body: { ...form.value, captcha_token: captchaToken || undefined },
    })
    state.value = 'done'
  } catch (e: any) {
    err.value = e?.data?.message || '注册失败'
    captchaRef.value?.reset?.()
    state.value = 'idle'
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="card auth-card">
      <div class="auth-brand">
        <img src="/logo.png" alt="" width="42" height="42" class="auth-logo">
        <div>
          <h1 class="auth-title">{{ state === 'done' ? '验证邮件已发送' : '创建账号' }}</h1>
          <p class="muted" style="font-size: 13px">
            {{ state === 'done' ? '完成邮箱验证后即可登录。' : '注册后即可关注用户、投稿插件与同步偏好。' }}
          </p>
        </div>
      </div>
      <div class="divider" />

      <template v-if="state === 'done'">
        <div class="success-panel">
          <span class="success-panel__icon"><MailCheck :size="26" aria-hidden="true" /></span>
          <h2>验证邮件已发送</h2>
          <p class="muted">请到 <strong>{{ form.email }}</strong> 的邮箱查收，24 小时内点击验证链接即可登录。</p>
        </div>
        <FButton appearance="primary" block @click="navigateTo('/login')">前往登录</FButton>
      </template>

      <form v-else class="form" @submit.prevent="submit">
        <div class="stack stack--xs">
          <label for="reg-email" class="field-label">邮箱</label>
          <FInput id="reg-email" v-model="form.email" type="email" autocomplete="email" placeholder="name@example.com" required />
        </div>
        <div class="stack stack--xs">
          <label for="reg-name" class="field-label">显示名</label>
          <FInput id="reg-name" v-model="form.display_name" :maxlength="16" placeholder="1–16 个字符" required />
        </div>
        <div class="stack stack--xs">
          <label for="reg-password" class="field-label">密码</label>
          <FInput id="reg-password" v-model="form.password" type="password" autocomplete="new-password" :minlength="8" :maxlength="128" placeholder="至少 8 位，包含字母和数字" required />
        </div>
        <div class="stack stack--xs">
          <label for="reg-confirm" class="field-label">确认密码</label>
          <FInput id="reg-confirm" v-model="passwordConfirm" type="password" autocomplete="new-password" :minlength="8" :maxlength="128" required @enter="submit" />
        </div>

        <CaptchaChallenge ref="captchaRef" id-suffix="register" />

        <div v-if="err" class="notice notice--warn" role="alert"><span>{{ err }}</span></div>

        <FButton type="submit" appearance="primary" size="large" block :loading="state === 'loading'">
          <template #start><UserPlus v-if="state !== 'loading'" :size="17" aria-hidden="true" /></template>
          {{ state === 'loading' ? '正在提交…' : '注册' }}
        </FButton>
      </form>

      <div class="auth-footer">
        <span class="muted">已有账号？</span>
        <NuxtLink to="/login">直接登录</NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-shell { display: grid; place-items: center; padding: 20px 0 40px; }
.auth-card { width: min(100%, 480px); padding: 26px; display: flex; flex-direction: column; gap: 18px; }
.auth-brand { display: flex; align-items: center; gap: 14px; }
.auth-logo { border-radius: 0; background: none; box-shadow: none; }
.auth-title { font-size: 24px; letter-spacing: -0.02em; }
.auth-footer { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
.success-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 8px 0; }
.success-panel__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--colorPaletteGreenBackground1, #dff6dd); color: var(--colorPaletteGreenForeground1, #0e700e); }
.success-panel h2 { font-size: 18px; }
@media (max-width: 680px) { .auth-card { padding: 20px; } }
</style>
