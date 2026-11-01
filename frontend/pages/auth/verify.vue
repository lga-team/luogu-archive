<script setup lang="ts">
import { CheckCircle2, House, LogIn, XCircle } from 'lucide-vue-next'

const route = useRoute()
const api = useApi()
const state = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    state.value = 'error'
    message.value = '验证链接缺少参数，请检查邮件里的完整链接'
    return
  }
  try {
    const resp = await api<{ message: string }>('/auth/verify', { query: { token } })
    state.value = 'success'
    message.value = resp.message || '邮箱验证成功'
  } catch (e: any) {
    state.value = 'error'
    message.value = e?.data?.message || '验证失败，链接可能已失效'
  }
})
</script>

<template>
  <div class="verify-shell">
    <div class="card verify-card" :data-state="state">
      <div class="verify-icon">
        <span v-if="state === 'loading'" class="skeleton verify-skeleton" aria-hidden="true" />
        <CheckCircle2 v-else-if="state === 'success'" :size="64" :stroke-width="1.4" class="ok" aria-hidden="true" />
        <XCircle v-else :size="64" :stroke-width="1.4" class="bad" aria-hidden="true" />
      </div>
      <span v-if="state === 'loading'" class="skeleton verify-line verify-line--title" aria-hidden="true" />
      <h1 v-else class="verify-title">{{ state === 'success' ? '验证成功' : '验证未成功' }}</h1>
      <span v-if="state === 'loading'" class="skeleton verify-line" aria-hidden="true" />
      <p v-else class="verify-desc">{{ message }}</p>
      <div class="verify-actions">
        <FButton v-if="state === 'success'" appearance="primary" @click="navigateTo('/login')">
          <template #start><LogIn :size="16" aria-hidden="true" /></template>前往登录
        </FButton>
        <template v-else-if="state === 'error'">
          <FButton appearance="outline" @click="navigateTo('/login')">去登录页重发</FButton>
          <FButton appearance="primary" @click="navigateTo('/register')">重新注册</FButton>
        </template>
      </div>
      <NuxtLink to="/" class="verify-home"><House :size="14" aria-hidden="true" />返回首页</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.verify-shell { min-height: 58vh; display: grid; place-items: center; padding: 24px 0; }
.verify-card {
  width: min(100%, 430px); padding: 34px 28px 24px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  border-top: 3px solid var(--colorBrandBackground);
}
.verify-card[data-state="success"] { border-top-color: var(--colorPaletteGreenForeground1, #0e700e); }
.verify-card[data-state="error"] { border-top-color: var(--colorPaletteRedForeground1, #b10e1c); }
.verify-icon { height: 70px; display: grid; place-items: center; }
.ok { color: var(--colorPaletteGreenForeground1, #0e700e); }
.bad { color: var(--colorPaletteRedForeground1, #b10e1c); }
.verify-title { font-size: 22px; }
.verify-desc { color: var(--colorNeutralForeground3); font-size: 14px; line-height: 1.7; max-width: 40ch; }
.verify-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
.verify-home { display: inline-flex; align-items: center; gap: 5px; color: var(--colorNeutralForeground3); font-size: 12px; }
.verify-line { display: block; width: min(100%, 260px); height: 12px; border-radius: 4px; margin: 4px auto; }
.verify-line--title { width: min(100%, 180px); height: 26px; margin-bottom: 10px; }
</style>
