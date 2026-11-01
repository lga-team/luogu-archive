/**
 * 认证状态管理（Pinia store）。
 *
 * access token 放内存 + sessionStorage（同一标签页刷新可恢复）。
 * 当后端与前端同源时，额外用 refresh cookie 恢复；跨域部署默认只依赖 token。
 */
import { defineStore } from 'pinia'

interface AuthState {
  accessToken: string | null
  expiresAt: number
  displayName: string
  email: string
  emailVerified: boolean
  initialized: boolean
}

const SESSION_KEY = 'la_session_v1'

function readSession(): { accessToken: string; expiresAt: number; displayName: string; email: string; emailVerified: boolean } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (
      typeof value?.accessToken !== 'string'
      || typeof value?.expiresAt !== 'number'
      || value.expiresAt <= Date.now()
    ) return null
    return value
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    expiresAt: 0,
    displayName: '',
    email: '',
    emailVerified: false,
    initialized: false,
  }),
  getters: {
    isLoggedIn: (s) => !!s.accessToken && s.expiresAt > Date.now(),
  },
  actions: {
    setTokens(data: {
      access_token: string
      expires_in: number
      display_name: string
      email: string
      email_verified: boolean
    }) {
      this.accessToken = data.access_token
      this.expiresAt = Date.now() + data.expires_in * 1000 - 10_000
      this.displayName = data.display_name
      this.email = data.email
      this.emailVerified = data.email_verified
      if (import.meta.client) {
        try {
          localStorage.setItem('la_logged', '1')
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
            displayName: this.displayName,
            email: this.email,
            emailVerified: this.emailVerified,
          }))
        } catch { /* 隐私模式下存储不可用 */ }
      }
    },
    restoreSession(): boolean {
      if (!import.meta.client) return false
      const saved = readSession()
      if (!saved) return false
      this.accessToken = saved.accessToken
      this.expiresAt = saved.expiresAt
      this.displayName = saved.displayName
      this.email = saved.email
      this.emailVerified = saved.emailVerified
      return true
    },
    clear() {
      this.accessToken = null
      this.expiresAt = 0
      this.displayName = ''
      this.email = ''
      this.emailVerified = false
      this.initialized = true
      if (import.meta.client) {
        try {
          localStorage.removeItem('la_logged')
          sessionStorage.removeItem(SESSION_KEY)
        } catch { /* ignore */ }
      }
    },
    async tryRefresh() {
      if (import.meta.server) return
      if (this.accessToken && this.expiresAt > Date.now()) {
        this.initialized = true
        return
      }
      if (this.restoreSession()) {
        this.initialized = true
        return
      }
      if (!localStorage.getItem('la_logged')) {
        this.clear()
        return
      }
      try {
        const api = useApi()
        const data = await api<any>('/auth/refresh', { method: 'POST' })
        this.setTokens(data)
      } catch {
        this.clear()
      } finally {
        this.initialized = true
      }
    },
  },
})
