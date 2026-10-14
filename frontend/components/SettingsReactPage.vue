<script setup lang="ts">
import type { Root } from 'react-dom/client'
import type { SettingsAccount, SettingsPageProps } from '../react/settings-page'

const props = defineProps<{ loginOnly?: boolean }>()
const auth = useAuthStore()
const api = useApi()
const colorMode = useColorMode()
const route = useRoute()
const host = ref<HTMLElement | null>(null)
const mountError = ref(false)
let root: Root | undefined
let disposed = false
let draw: (() => void) | undefined
const loading = ref(false)
const loggingOut = ref(false)
const error = ref('')
const account = ref<SettingsAccount | null>(null)
let request = 0

async function loadAccount() {
  const current = ++request
  account.value = null
  error.value = ''
  if (!auth.isLoggedIn) { loading.value = false; return }
  loading.value = true
  try {
    const data = await api<SettingsAccount>('/auth/me')
    if (current === request) account.value = data
  } catch (reason: any) {
    if (current === request) error.value = reason?.data?.message || '账号信息加载失败'
  } finally {
    if (current === request) loading.value = false
  }
}
onMounted(() => { if (!props.loginOnly) void loadAccount() })
watch(() => auth.isLoggedIn, () => { if (import.meta.client && !props.loginOnly) void loadAccount() })
onBeforeUnmount(() => { disposed = true; request += 1; root?.unmount() })

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
onMounted(async () => {
  try {
    const [{ createRoot }, { createElement }, { SettingsPage, LoginPage }] = await Promise.all([
      import('react-dom/client'), import('react'), import('../react/settings-page'),
    ])
    if (disposed || !host.value) return
    root = createRoot(host.value)
    draw = () => {
      const pageProps: SettingsPageProps = {
        initialized: auth.initialized,
        loggedIn: auth.isLoggedIn,
        displayName: auth.displayName,
        email: auth.email,
        account: account.value,
        loading: loading.value,
        loggingOut: loggingOut.value,
        error: error.value,
        theme: colorMode.preference,
        login: async (body) => {
          const data = await api<Parameters<typeof auth.setTokens>[0]>('/auth/login', { method: 'POST', body })
          auth.setTokens(data)
          if (props.loginOnly) {
            const path = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
            await navigateTo(path.startsWith('/') && !path.startsWith('//') ? path : '/')
          }
        },
        resend: email => api<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } }),
        logout,
        retry: () => { void loadAccount() },
        challenge: () => api<{ verification_text: string }>('/auth/luogu-bind/challenge', { method: 'POST' }),
        verify: async pasteId => {
          const data = await api<{ luogu_uid: number }>('/auth/luogu-bind/verify', { method: 'POST', body: { paste_id: pasteId } })
          if (account.value) account.value.luogu_uid = data.luogu_uid
        },
        changeTheme: theme => { colorMode.preference = theme },
        navigate: path => { void navigateTo(path) },
      }
      root?.render(createElement(props.loginOnly ? LoginPage : SettingsPage, pageProps))
    }
    draw()
  } catch {
    if (!disposed) mountError.value = true
  }
})
watch(() => [
  auth.initialized, auth.isLoggedIn, auth.displayName, auth.email, account.value,
  loading.value, loggingOut.value, error.value, colorMode.preference,
], () => draw?.(), { deep: true })
</script>
<template>
  <div ref="host" class="archive-react">
    <div class="settings-shell"><h1>{{ loginOnly ? '登录' : '设置' }}</h1><p role="status">{{ mountError ? '页面加载失败，请刷新重试。' : '正在加载…' }}</p></div>
  </div>
</template>

<style src="../react/archive.css" />
