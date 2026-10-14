<script setup lang="ts">
import { LogOut, Monitor, Moon, Sun, UserRound, Palette } from 'lucide-vue-next'

useHead({ title: '设置 - 洛谷档案馆' })
const auth = useAuthStore()
const api = useApi()
const colorMode = useColorMode()
const section = ref<'account' | 'appearance'>('account')
const ready = ref(false)
const loading = ref(false)
const loggingOut = ref(false)
const error = ref('')
interface Account {
  email: string
  display_name: string
  luogu_uid: number | null
  luogu_bound_at: string | null
}
const account = ref<Account | null>(null)
let request = 0
const themes = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

async function loadAccount() {
  const current = ++request
  account.value = null
  error.value = ''
  if (!auth.isLoggedIn) { loading.value = false; return }
  loading.value = true
  try {
    const data = await api<Account>('/auth/me')
    if (current === request) account.value = data
  } catch (reason: any) {
    if (current === request) error.value = reason?.data?.message || '账号信息加载失败'
  } finally {
    if (current === request) loading.value = false
  }
}
onMounted(() => { ready.value = true; void loadAccount() })
watch(() => auth.isLoggedIn, () => { if (import.meta.client) void loadAccount() })
onBeforeUnmount(() => { request += 1 })

async function logout() {
  loggingOut.value = true
  error.value = ''
  try {
    await api('/auth/logout', { method: 'POST' })
    auth.clear()
  } catch (reason: any) {
    error.value = reason?.data?.message || '退出失败，请重试'
  } finally {
    loggingOut.value = false
  }
}
function selectSection(value: 'account' | 'appearance') {
  section.value = value
  nextTick(() => document.getElementById(`settings-tab-${value}`)?.focus())
}
function handleBound(uid: number) {
  if (account.value) account.value.luogu_uid = uid
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-heading"><h1>设置</h1></header>
    <div class="settings-tabs" role="tablist" aria-label="设置分类">
      <button id="settings-tab-account" type="button" role="tab" :aria-selected="section === 'account'" aria-controls="settings-account" :tabindex="section === 'account' ? 0 : -1" @click="section = 'account'" @keydown.right.prevent="selectSection('appearance')" @keydown.left.prevent="selectSection('appearance')">
        <UserRound :size="16" aria-hidden="true" />账号
      </button>
      <button id="settings-tab-appearance" type="button" role="tab" :aria-selected="section === 'appearance'" aria-controls="settings-appearance" :tabindex="section === 'appearance' ? 0 : -1" @click="section = 'appearance'" @keydown.right.prevent="selectSection('account')" @keydown.left.prevent="selectSection('account')">
        <Palette :size="16" aria-hidden="true" />外观
      </button>
    </div>

    <section v-show="section === 'account'" id="settings-account" role="tabpanel" aria-labelledby="settings-tab-account" tabindex="0">
      <p v-if="!ready || !auth.initialized" class="muted" role="status">正在恢复登录状态…</p>
      <template v-else-if="!auth.isLoggedIn">
        <h2>登录账号</h2>
        <AccountLoginForm :redirect-after-login="false" />
      </template>
      <template v-else>
        <div class="setting-row">
          <div class="setting-value"><h2>{{ account?.display_name || auth.displayName }}</h2><p>{{ account?.email || auth.email }}</p></div>
          <NuxtLink to="/me" class="archive-action-button">我的关注</NuxtLink>
        </div>
        <p v-if="loading" class="muted" role="status">正在加载账号信息…</p>
        <div v-else-if="account" class="setting-row">
          <div class="setting-value"><h2>洛谷账号</h2><p>{{ account.luogu_uid ? `UID ${account.luogu_uid}` : '未绑定' }}</p></div>
          <LuoguBindButton :luogu-uid="account.luogu_uid" @bound="handleBound" />
        </div>
        <div v-if="error" class="setting-error" role="alert"><p>{{ error }}</p><button v-if="!account && !loading" type="button" class="archive-action-button" @click="loadAccount">重试</button></div>
        <div class="setting-row logout-row">
          <button type="button" class="archive-action-button" :disabled="loggingOut" @click="logout"><LogOut :size="16" aria-hidden="true" />{{ loggingOut ? '正在退出…' : '退出登录' }}</button>
        </div>
      </template>
    </section>

    <section v-show="section === 'appearance'" id="settings-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" tabindex="0">
      <h2>主题</h2>
      <ClientOnly>
        <fieldset class="theme-options">
          <legend class="sr-only">主题模式</legend>
          <label v-for="theme in themes" :key="theme.value" class="theme-option" :class="{ selected: colorMode.preference === theme.value }">
            <input v-model="colorMode.preference" type="radio" name="theme" :value="theme.value">
            <component :is="theme.icon" :size="20" aria-hidden="true" />
            <span>{{ theme.label }}</span>
          </label>
        </fieldset>
        <template #fallback><p class="muted" role="status">正在加载主题设置…</p></template>
      </ClientOnly>
    </section>
  </div>
</template>

<style scoped>
.settings-page { max-width: 760px; margin: 12px auto; }
.settings-heading h1 { font-size: 28px; font-weight: 600; margin: 0 0 24px; }
.settings-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 28px; }
.settings-tabs button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); font: inherit; font-size: 14px; cursor: pointer; }
.settings-tabs button[aria-selected="true"] { color: var(--text); border-bottom-color: var(--link); }
h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; overflow-wrap: anywhere; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 0; border-bottom: 1px solid var(--border); }
.setting-row:first-child { padding-top: 0; }
.setting-value { min-width: 0; }
.setting-value h2 { margin-bottom: 4px; }
.setting-value p { margin: 0; color: var(--text-muted); font-size: 14px; overflow-wrap: anywhere; }
.logout-row { border-bottom: 0; }
.muted { color: var(--text-muted); font-size: 14px; }
.setting-error { color: var(--lg-red); font-size: 14px; }
.theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 0; padding: 0; margin: 0; gap: 12px; }
.theme-option { display: flex; align-items: center; gap: 10px; min-height: 72px; padding: 12px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: 14px; cursor: pointer; }
.theme-option.selected { border-color: var(--link); }
.theme-option input { accent-color: var(--link); margin: 0; }
.theme-option svg { flex-shrink: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
button:focus-visible, a:focus-visible, .theme-option:focus-within { outline: 2px solid var(--link); outline-offset: 3px; }
@media (max-width: 560px) {
  .setting-row { flex-wrap: wrap; gap: 12px; }
  .theme-options { grid-template-columns: 1fr; }
  .theme-option { min-height: 52px; }
}
</style>
