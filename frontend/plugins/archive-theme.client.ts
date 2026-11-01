import { applyTheme, readTheme, THEME_KEY } from '../lib/luoguTheme'

const DISPLAY_MODE_KEY = 'la-display-mode'

function applyCurrentTheme() {
  const mode = localStorage.getItem(DISPLAY_MODE_KEY)
  if (mode === 'custom') applyTheme(readTheme())
  else applyTheme({ ...readTheme(), enabled: false })
}

export default defineNuxtPlugin(() => {
  // 在挂载页面前恢复；浅色/深色/跟随系统不使用洛谷主题。
  applyCurrentTheme()
  window.addEventListener('storage', event => {
    if (event.key === THEME_KEY || event.key === DISPLAY_MODE_KEY || event.key === null) applyCurrentTheme()
  })
  window.addEventListener('pageshow', applyCurrentTheme)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyCurrentTheme() })
})
