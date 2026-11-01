<script setup lang="ts">
import { LogIn, ShieldCheck } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const form = ref({ username: '', password: '', totp_code: '' })
const err = ref('')
const loading = ref(false)
const api = useAdminApi()
const admin = useAdminStore()

async function submit() {
  err.value = ''
  loading.value = true
  try {
    const data = await api<any>('/admin/login', { method: 'POST', body: form.value })
    admin.setToken(data)
    navigateTo('/admin')
  } catch (e: any) {
    err.value = e?.data?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="card admin-login__card">
      <div class="stack" style="align-items:center;text-align:center;gap:8px">
        <span class="admin-login__icon"><ShieldCheck :size="26" aria-hidden="true" /></span>
        <h1 style="font-size:24px">管理员登录</h1>
        <p class="muted" style="font-size:13px">洛谷档案馆 · 管理后台</p>
      </div>
      <div class="divider" />
      <form class="form" @submit.prevent="submit">
        <div class="stack stack--xs"><label for="admin-username" class="field-label">用户名</label><FInput id="admin-username" v-model="form.username" autocomplete="username" required /></div>
        <div class="stack stack--xs"><label for="admin-password" class="field-label">密码</label><FInput id="admin-password" v-model="form.password" type="password" autocomplete="current-password" required /></div>
        <div class="stack stack--xs"><label for="admin-totp" class="field-label">2FA 验证码（6 位）</label><FInput id="admin-totp" v-model="form.totp_code" :maxlength="6" autocomplete="one-time-code" required /></div>
        <div v-if="err" class="notice notice--warn" role="alert">{{ err }}</div>
        <FButton type="submit" appearance="primary" size="large" block :loading="loading">
          <template #start><LogIn v-if="!loading" :size="17" aria-hidden="true" /></template>
          {{ loading ? '登录中…' : '登录' }}
        </FButton>
      </form>
      <NuxtLink to="/" class="muted" style="text-align:center;font-size:12px">返回前台</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.admin-login { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
.admin-login__card { width: min(100%, 420px); padding: 26px; display: flex; flex-direction: column; gap: 18px; }
.admin-login__icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: var(--borderRadiusXLarge); background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); }
</style>
