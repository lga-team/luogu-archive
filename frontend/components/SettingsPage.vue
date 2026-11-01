<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Check, CircleUserRound, FolderOpen, LogOut, Monitor, Moon, Palette, RefreshCw,
  ShieldCheck, Sun, Upload, UserRound,
} from 'lucide-vue-next'
import LoginForm from './settings/AccountLoginForm.vue'
import BindingDialog from './settings/AccountBindingDialog.vue'
import ThemeEditor from './settings/ThemeEditor.vue'
import type { DisplayMode } from '~/composables/useDisplayMode'

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
const tab = ref('account')
const { mode: displayMode, setMode } = useDisplayMode()

const themeModes = [
  { value: 'light', label: '浅色', description: '明亮通透的 Fluent 主题', icon: Sun },
  { value: 'dark', label: '深色', description: '低光环境更舒适', icon: Moon },
  { value: 'system', label: '跟随系统', description: '随设备外观自动切换', icon: Monitor },
  { value: 'custom', label: '自定义', description: '使用洛谷主题自定义页面', icon: Palette },
]

const tabs = [
  { id: 'account', label: '账号', icon: UserRound },
  { id: 'appearance', label: '外观', icon: Palette },
]

let request = 0
let disposed = false

async function loadAccount() {
  const current = ++request
  account.value = null
  error.value = ''
  if (!auth.isLoggedIn) { loading.value = false; return }
  loading.value = true
  try {
    const data = await api<SettingsAccount>('/auth/me')
    if (!disposed && current === request) account.value = data
  } catch (reason: any) {
    if (!disposed && current === request) error.value = reason?.data?.message || '账号信息加载失败'
  } finally {
    if (!disposed && current === request) loading.value = false
  }
}

onMounted(() => {
  if (!props.loginOnly) void loadAccount()
})
watch(() => auth.isLoggedIn, () => {
  if (import.meta.client && !props.loginOnly) void loadAccount()
})
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
  loggingOut.value = true
  error.value = ''
  try {
    await api('/auth/logout', { method: 'POST' })
    auth.clear()
  } catch (reason: any) {
    if (!disposed) error.value = reason?.data?.message || '退出失败，请重试'
  } finally {
    if (!disposed) loggingOut.value = false
  }
}

async function verify(pasteId: string) {
  const data = await api<{ luogu_uid: number }>('/auth/luogu-bind/verify', { method: 'POST', body: { paste_id: pasteId } })
  if (!disposed && account.value) {
    account.value.luogu_uid = data.luogu_uid
    account.value.luogu_bound_at = new Date().toISOString()
  }
}

function selectDisplayMode(value: string) {
  setMode(value as DisplayMode)
}
</script>

<template>
  <div v-if="loginOnly" class="login-shell">
    <div class="login-card card">
      <div class="login-brand">
        <img src="/logo.png" alt="" width="44" height="44" class="login-brand__logo">
        <div>
          <h1 class="login-brand__title">洛谷档案馆</h1>
          <p class="muted" style="font-size: 13px">登录后关注用户、管理插件与同步偏好。</p>
        </div>
      </div>
      <div class="divider" />
      <template v-if="auth.initialized">
        <div v-if="auth.isLoggedIn" class="stack">
          <div class="notice notice--brand">
            <ShieldCheck :size="18" aria-hidden="true" />
            <span>你已经登录为 <strong>{{ auth.displayName }}</strong>。</span>
          </div>
          <div class="cluster">
            <FButton appearance="primary" @click="navigateTo('/')">回到首页</FButton>
            <FButton appearance="outline" @click="navigateTo('/settings')">账号设置</FButton>
          </div>
        </div>
        <LoginForm v-else :login="login" />
      </template>
      <LoadingPanel v-else variant="list" :rows="2" compact title="正在恢复登录状态" />
      <div class="login-footer">
        <span class="muted">还没有账号？</span>
        <NuxtLink to="/register">创建账号</NuxtLink>
      </div>
    </div>
  </div>

  <div v-else class="page page--medium">
    <PageHeader title="设置" description="管理站点账号、洛谷绑定与界面外观。">
      <template #icon><CircleUserRound :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <FTabList v-model="tab" :tabs="tabs" aria-label="设置分类" />

    <Transition name="settings-fade" mode="out-in">
      <section v-if="tab === 'account'" key="account" class="page-section">
        <LoadingPanel v-if="!auth.initialized" variant="list" :rows="2" compact title="正在恢复登录状态" />

        <div v-else-if="!auth.isLoggedIn" class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">登录账号</h2>
              <p class="card__description">登录后即可使用关注、插件投稿与账号绑定功能。</p>
            </div>
            <span class="tag">未登录</span>
          </div>
          <div class="card__body">
            <LoginForm :login="login" />
          </div>
        </div>

        <template v-else>
          <div class="profile-card card">
            <LuoguAvatar
              v-if="account?.luogu_uid"
              :user="{ uid: account.luogu_uid, name: account.display_name }"
              :size="56"
            />
            <FAvatar v-else :name="account?.display_name || auth.displayName" :size="56" />
            <div class="profile-card__main">
              <div class="cluster" style="gap: 8px">
                <h2 class="profile-card__name">{{ account?.display_name || auth.displayName }}</h2>
                <span class="tag tag--success">已登录</span>
              </div>
              <p class="muted" style="font-size: 13px">{{ account?.email || auth.email }}</p>
            </div>
            <div class="profile-card__actions">
              <FButton appearance="outline" @click="navigateTo('/me')">
                <template #start><UserRound :size="16" aria-hidden="true" /></template>
                我的关注
              </FButton>
              <FButton appearance="outline" @click="navigateTo('/plugin/manage')">
                <template #start><FolderOpen :size="16" aria-hidden="true" /></template>
                我的插件
              </FButton>
              <FButton appearance="outline" @click="navigateTo('/plugin/submit')">
                <template #start><Upload :size="16" aria-hidden="true" /></template>
                投稿插件
              </FButton>
              <FButton appearance="outline" :disabled="loggingOut" @click="logout">
                <template #start><LogOut :size="16" aria-hidden="true" /></template>
                {{ loggingOut ? '正在退出…' : '退出登录' }}
              </FButton>
            </div>
          </div>

          <div class="grid grid--2">
            <div class="card">
              <div class="card__header">
                <div>
                  <h3 class="card__title">洛谷账号</h3>
                  <p class="card__description">绑定后可认领自己的内容与关注关系。</p>
                </div>
              </div>
              <div class="card__body stack">
                <div class="binding-row">
                  <div class="stack stack--xs">
                    <span class="muted" style="font-size: 12px">绑定状态</span>
                    <span v-if="loading" class="skeleton skeleton--line" style="width: 120px; display: inline-block" />
                    <strong v-else-if="account?.luogu_uid" class="success-text">UID {{ account.luogu_uid }}</strong>
                    <strong v-else-if="account">未绑定</strong>
                    <strong v-else>账号信息暂不可用</strong>
                  </div>
                  <div class="cluster">
                    <FButton v-if="account?.luogu_uid" appearance="outline" @click="navigateTo('/user/' + account.luogu_uid)">
                      查看用户
                    </FButton>
                    <BindingDialog v-else-if="account" :verify="verify" />
                  </div>
                </div>
                <div v-if="error" class="notice notice--warn" role="alert">
                  <span>{{ error }}</span>
                  <FButton v-if="!account" appearance="subtle" size="small" :disabled="loading" @click="loadAccount">
                    <template #start><RefreshCw :size="14" /></template>重试
                  </FButton>
                </div>
                <p class="field-help">绑定不会公开你的 Cookie，仅保存洛谷 UID。</p>
              </div>
            </div>

            <div class="card">
              <div class="card__header">
                <div>
                  <h3 class="card__title">登录邮箱</h3>
                  <p class="card__description">用于找回密码与接收站点通知。</p>
                </div>
              </div>
              <div class="card__body stack">
                <strong style="font-size: 15px">{{ account?.email || auth.email }}</strong>
                <span class="tag" :class="auth.emailVerified ? 'tag--success' : 'tag--warn'">
                  {{ auth.emailVerified ? '已验证' : '未验证' }}
                </span>
                <p class="field-help">修改邮箱与密码功能由站点账号系统统一管理。</p>
              </div>
            </div>
          </div>
        </template>
      </section>

      <section v-else key="appearance" class="page-section">
        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">界面外观</h2>
              <p class="card__description">浅色 / 深色 / 跟随系统使用 Fluent 原生主题；自定义模式才启用洛谷主题。</p>
            </div>
          </div>
          <div class="card__body">
            <div class="theme-mode-grid" role="radiogroup" aria-label="主题模式">
              <button
                v-for="mode in themeModes"
                :key="mode.value"
                type="button"
                role="radio"
                :aria-checked="displayMode === mode.value"
                class="theme-mode"
                :class="{ 'is-selected': displayMode === mode.value }"
                @click="selectDisplayMode(mode.value)"
              >
                <span class="theme-mode__icon"><component :is="mode.icon" :size="20" aria-hidden="true" /></span>
                <span class="theme-mode__title">{{ mode.label }}</span>
                <span class="theme-mode__desc">{{ mode.description }}</span>
                <Check v-if="displayMode === mode.value" :size="16" class="theme-mode__check" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <ThemeEditor v-if="displayMode === 'custom'" :resolved-theme="colorMode.value" />
        <div v-else class="notice">
          <span>当前使用 Fluent 原生主题。切换到「自定义」后可导入并编辑洛谷主题；浅色与深色模式不支持页面自定义。</span>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: calc(100dvh - 220px);
  display: grid;
  place-items: center;
  padding: 8px 0 24px;
}
.login-card { width: min(100%, 460px); padding: 26px; display: flex; flex-direction: column; gap: 18px; }
.login-brand { display: flex; align-items: center; gap: 14px; }
.login-brand__logo { border-radius: 0; background: none; box-shadow: none; }
.login-brand__title { font-size: 24px; letter-spacing: -0.02em; }
.login-footer { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  flex-wrap: wrap;
}
.profile-card__main { flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.profile-card__name { font-size: 20px; }
.profile-card__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.binding-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

.theme-mode-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.theme-mode {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  text-align: left;
  border-radius: var(--borderRadiusLarge);
  border: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground1);
  color: var(--colorNeutralForeground1);
  cursor: pointer;
  transition: border-color var(--app-transition), background var(--app-transition), box-shadow var(--app-transition);
}
.theme-mode:hover { border-color: var(--colorNeutralStroke1); background: var(--colorNeutralBackground1Hover); }
.theme-mode.is-selected { border-color: var(--colorBrandStroke1); background: var(--colorBrandBackground2); box-shadow: 0 0 0 1px var(--colorBrandStroke1); }
.theme-mode__icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: var(--borderRadiusMedium); background: var(--colorNeutralBackground3); }
.theme-mode__title { font-weight: 600; font-size: 14px; }
.theme-mode__desc { color: var(--colorNeutralForeground3); font-size: 11.5px; line-height: 1.5; }
.theme-mode__check { position: absolute; top: 12px; right: 12px; color: var(--colorBrandForeground1); }
.settings-fade-enter-active, .settings-fade-leave-active { transition: opacity .14s ease, transform .14s ease; }
.settings-fade-enter-from, .settings-fade-leave-to { opacity: 0; transform: translateY(4px); }

@media (max-width: 1020px) {
  .theme-mode-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
  .theme-mode-grid { grid-template-columns: minmax(0, 1fr); }
  .login-card { padding: 20px; }
}
</style>
