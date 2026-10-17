<script setup lang="ts">
import { LogOut, Monitor, Moon, Sun, UserRound, Palette } from 'lucide-vue-next'
import { Button, Label, Tabs, TabsList, TabsTrigger, TabsContent, RadioGroup, RadioGroupItem } from './ui'
import LoginForm from './settings/AccountLoginForm.vue'
import BindingDialog from './settings/AccountBindingDialog.vue'
import ThemeEditor from './settings/ThemeEditor.vue'
interface SettingsAccount { email: string; display_name: string; luogu_uid: number | null; luogu_bound_at: string | null }
const props = defineProps<{ loginOnly?: boolean }>()
const auth = useAuthStore()
const api = useApi()
const colorMode = useColorMode()
const route = useRoute()
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
onMounted(() => { if (!props.loginOnly) void loadAccount() })
watch(() => auth.isLoggedIn, () => { if (import.meta.client && !props.loginOnly) void loadAccount() })
onBeforeUnmount(() => { disposed = true; request++ })
async function login(body: { email: string; password: string }) {
  const data = await api<Parameters<typeof auth.setTokens>[0]>('/auth/login', { method: 'POST', body })
  auth.setTokens(data)
  if (props.loginOnly && !disposed) {
    const path = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(path.startsWith('/') && !path.startsWith('//') ? path : '/')
  }
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
  <div class="archive-ui">
    <div v-if="loginOnly" class="settings-shell settings-login-shell"><header class="settings-heading"><h1>登录</h1></header><LoginForm v-if="auth.initialized" :login="login" /><p v-else class="archive-muted" role="status">正在恢复登录状态…</p></div>
    <div v-else class="settings-shell">
      <header class="settings-heading"><h1>设置</h1></header>
      <Tabs default-value="account">
        <TabsList aria-label="设置分类"><TabsTrigger value="account"><UserRound :size="16" aria-hidden="true" />账号</TabsTrigger><TabsTrigger value="appearance"><Palette :size="16" aria-hidden="true" />外观</TabsTrigger></TabsList>
        <TabsContent value="account">
          <p v-if="!auth.initialized" class="archive-muted" role="status">正在恢复登录状态…</p>
          <template v-else-if="!auth.isLoggedIn"><div class="settings-section-heading"><h2>登录账号</h2><span class="settings-status">未登录</span></div><LoginForm :login="login" /></template>
          <template v-else>
            <div class="settings-section-heading"><h2>站点账号</h2><span class="settings-status">已登录</span></div>
            <dl class="settings-details"><div><dt>昵称</dt><dd>{{ account?.display_name || auth.displayName }}</dd></div><div><dt>邮箱</dt><dd>{{ account?.email || auth.email }}</dd></div></dl>
            <Button variant="outline" as-child><NuxtLink to="/me">我的关注</NuxtLink></Button>
            <div class="settings-binding"><div><h2>洛谷账号</h2><p class="archive-muted">{{ loading ? '正在加载…' : account?.luogu_uid ? 'UID ' + account.luogu_uid : account ? '未绑定' : '账号信息暂不可用' }}</p></div>
              <template v-if="account"><Button v-if="account.luogu_uid" variant="outline" as-child><NuxtLink :to="'/user/' + account.luogu_uid">查看用户</NuxtLink></Button><BindingDialog v-else :verify="verify" /></template>
            </div>
            <div v-if="error" class="settings-message" role="alert"><p class="archive-error">{{ error }}</p><Button v-if="!account" variant="outline" :disabled="loading" @click="loadAccount">重试</Button></div>
            <Button variant="outline" :disabled="loggingOut" @click="logout"><LogOut :size="16" aria-hidden="true" />{{ loggingOut ? '正在退出…' : '退出登录' }}</Button>
          </template>
        </TabsContent>
        <TabsContent value="appearance">
          <div class="settings-section-heading"><h2>主题</h2></div>
          <RadioGroup :model-value="colorMode.preference" aria-label="主题模式" class="settings-themes" @update:model-value="colorMode.preference = $event || 'system'">
            <Label v-for="theme in themes" :key="theme.value" class="settings-theme" :for="'settings-theme-' + theme.value" :data-selected="colorMode.preference === theme.value"><RadioGroupItem :id="'settings-theme-' + theme.value" :value="theme.value" /><component :is="theme.icon" :size="20" aria-hidden="true" /><span>{{ theme.label }}</span></Label>
          </RadioGroup>
          <ThemeEditor :resolved-theme="colorMode.value" />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
