<script setup lang="ts">
import { LogOut, Monitor, Moon, Sun, UserRound, Palette } from 'lucide-vue-next'
import { Button, Label, Tabs, TabsList, TabsTrigger, TabsContent, RadioGroup, RadioGroupItem } from './ui'
import LoginForm from './settings/AccountLoginForm.vue'
import RegisterForm from './settings/AccountRegisterForm.vue'
import BindingDialog from './settings/AccountBindingDialog.vue'
import ThemeEditor from './settings/ThemeEditor.vue'
import { safeAuthReturn, settingsAuthRoute } from '~/utils/settingsAuth'
interface SettingsAccount { email: string; display_name: string; luogu_uid: number | null; luogu_bound_at: string | null }
const auth = useAuthStore()
const api = useApi()
const colorMode = useColorMode()
const route = useRoute()
const activeTab = ref('account')
const mounted = ref(false)
const registering = computed(() => route.query.mode === 'register')
watch(() => [route.query.mode, route.query.redirect], () => {
  if (route.query.mode === 'login' || registering.value) activeTab.value = 'account'
})
const loading = ref(false)
const loggingOut = ref(false)
const error = ref('')
const account = ref<SettingsAccount | null>(null)
const themes = [{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Monitor }]
let request = 0
let disposed = false
async function loadAccount() {
  const current = ++request
  account.value = null; error.value = ''
  if (!auth.isLoggedIn) { loading.value = false; return }
  loading.value = true
  try {
    const data = await api<SettingsAccount>('/auth/me')
    if (!disposed && current === request) account.value = data
  } catch (reason: any) { if (!disposed && current === request) error.value = reason?.data?.message || '账号信息加载失败' }
  finally { if (!disposed && current === request) loading.value = false }
}
onMounted(() => { mounted.value = true; void loadAccount() })
watch(() => auth.isLoggedIn, () => { if (import.meta.client) void loadAccount() })
onBeforeUnmount(() => { disposed = true; request++ })
async function login(body: { email: string; password: string }) {
  const destination = safeAuthReturn(route.query.redirect)
  const data = await api<Parameters<typeof auth.setTokens>[0]>('/auth/login', { method: 'POST', body })
  auth.setTokens(data)
  if (destination && !disposed) await navigateTo(destination, { replace: true })
}
async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true; error.value = ''
  try { await api('/auth/logout', { method: 'POST' }); auth.clear() }
  catch (reason: any) { if (!disposed) error.value = reason?.data?.message || '退出失败，请重试' }
  finally { if (!disposed) loggingOut.value = false }
}
async function verify(pasteId: string) {
  const data = await api<{ luogu_uid: number }>('/auth/luogu-bind/verify', { method: 'POST', body: { paste_id: pasteId } })
  if (!disposed && account.value) account.value.luogu_uid = data.luogu_uid
}
</script>
<template>
  <div class="archive-ui settings-shell settings-page">
    <ArchivePageHeader title="设置" description="账号与站点外观" icon="settings" />
    <Tabs v-model="activeTab" class="settings-panel" :class="{ 'archive-card': activeTab === 'account' }">
      <div class="settings-tabs-bar" :class="{ 'archive-card settings-tabs-bar-appearance': activeTab === 'appearance' }">
        <TabsList aria-label="设置分类">
          <TabsTrigger value="account"><UserRound :size="16" aria-hidden="true" />账号</TabsTrigger>
          <TabsTrigger value="appearance"><Palette :size="16" aria-hidden="true" />外观</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="account" class="settings-panel-content">
          <p v-if="!mounted || !auth.initialized" class="archive-muted" role="status">正在恢复登录状态…</p>
          <template v-else-if="!auth.isLoggedIn">
            <div class="settings-section-heading"><h2>{{ registering ? '注册账号' : '登录账号' }}</h2><span class="settings-status">未登录</span></div>
            <RegisterForm v-if="registering"><Button as-child variant="ghost"><NuxtLink :to="settingsAuthRoute('login', route.query.redirect)">登录</NuxtLink></Button></RegisterForm>
            <LoginForm v-else :login="login"><Button as-child variant="ghost"><NuxtLink :to="settingsAuthRoute('register', route.query.redirect)">创建账号</NuxtLink></Button></LoginForm>
          </template>
          <template v-else>
            <section aria-labelledby="settings-account-heading">
              <div class="settings-section-heading"><h2 id="settings-account-heading">站点账号</h2><span class="settings-status">已登录</span></div>
              <dl class="settings-details"><div><dt>昵称</dt><dd>{{ account?.display_name || auth.displayName }}</dd></div><div><dt>邮箱</dt><dd>{{ account?.email || auth.email }}</dd></div></dl>
              <Button variant="outline" as-child><NuxtLink to="/me">我的关注</NuxtLink></Button>
            </section>
            <section class="settings-binding" aria-labelledby="settings-binding-heading">
              <div><h2 id="settings-binding-heading">洛谷账号</h2><p class="archive-muted">{{ loading ? '正在加载…' : account?.luogu_uid ? 'UID ' + account.luogu_uid : account ? '未绑定' : '账号信息暂不可用' }}</p></div>
              <template v-if="account"><Button v-if="account.luogu_uid" variant="outline" as-child><NuxtLink :to="'/user/' + account.luogu_uid">查看用户</NuxtLink></Button><BindingDialog v-else :verify="verify" /></template>
            </section>
            <div class="settings-account-actions">
              <div v-if="error" class="settings-message" role="alert"><p class="archive-error">{{ error }}</p><Button v-if="!account" variant="outline" :disabled="loading" @click="loadAccount">重试</Button></div>
              <Button class="settings-logout" variant="outline" :disabled="loggingOut" @click="logout"><LogOut :size="16" aria-hidden="true" />{{ loggingOut ? '正在退出…' : '退出登录' }}</Button>
            </div>
          </template>
      </TabsContent>
      <TabsContent value="appearance" class="settings-appearance">
        <section class="archive-card settings-panel-content settings-theme-mode" aria-labelledby="settings-theme-heading">
          <div class="settings-section-heading"><h2 id="settings-theme-heading">主题</h2></div>
          <RadioGroup :model-value="colorMode.preference" aria-label="主题模式" class="settings-themes" @update:model-value="colorMode.preference = $event || 'system'">
            <Label v-for="theme in themes" :key="theme.value" class="settings-theme" :for="'settings-theme-' + theme.value" :data-selected="colorMode.preference === theme.value"><RadioGroupItem :id="'settings-theme-' + theme.value" :value="theme.value" /><component :is="theme.icon" :size="20" aria-hidden="true" /><span>{{ theme.label }}</span></Label>
          </RadioGroup>
        </section>
        <ThemeEditor :resolved-theme="colorMode.value" />
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
.settings-page { display: grid; gap: 20px; width: 100%; max-width: 1180px; min-width: 0; margin: 0 auto; }
.settings-panel { gap: 0; min-width: 0; padding: 0; }
.settings-tabs-bar { padding: 14px 24px; border-bottom: 1px solid var(--border); }
.settings-panel-content { min-width: 0; margin: 0; padding: 24px; }
.settings-panel-content:focus-visible { outline-offset: -2px; }
.settings-account-actions { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
.settings-logout { margin-left: auto; }
.settings-tabs-bar-appearance { align-items: flex-start; border-radius: 8px 8px 0 0; }
.settings-appearance { margin-top: 0; }
.settings-theme-mode { display: block; border-top: 0; border-radius: 0 0 8px 8px; }
@media (max-width: 640px) {
  .settings-tabs-bar, .settings-panel-content { padding: 16px; }
}
</style>
