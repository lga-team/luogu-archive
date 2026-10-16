import { applyTheme, readTheme, THEME_KEY } from '../utils/luoguTheme'

export default defineNuxtPlugin(() => {
  // 在挂载页面前恢复；CSS 作用域保证旧页面和暗色模式不受影响。
  const restore = () => applyTheme(readTheme())
  restore()
  window.addEventListener('storage', event => { if (event.key === THEME_KEY || event.key === null) restore() })
  window.addEventListener('pageshow', restore)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) restore() })
})
