/**
 * 应用挂载后再尝试恢复登录态，避免插件在 hydration 前修改 store
 * 造成服务端与客户端首帧不一致。
 */
import { onNuxtReady } from '#app'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  const auth = useAuthStore()
  onNuxtReady(() => {
    void auth.tryRefresh()
  })
})
