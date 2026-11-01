import { applyTheme, readTheme } from '~/lib/luoguTheme'

export type DisplayMode = 'light' | 'dark' | 'system' | 'custom'
export const DISPLAY_MODE_KEY = 'la-display-mode'

function normalizeMode(value: string | null | undefined): DisplayMode {
  return value === 'light' || value === 'dark' || value === 'custom' ? value : 'system'
}

/**
 * 页面外观模式：
 * - light / dark / system：Fluent 原生主题，不使用洛谷主题
 * - custom：浅色基底 + 洛谷主题自定义
 */
export function useDisplayMode() {
  const colorMode = useColorMode()
  const mode = useState<DisplayMode>('display-mode', () => 'system')
  let initialized = false

  function apply(next: DisplayMode) {
    mode.value = next
    if (import.meta.client) {
      localStorage.setItem(DISPLAY_MODE_KEY, next)
      if (next === 'custom') {
        colorMode.preference = 'light'
        applyTheme(readTheme())
      } else {
        colorMode.preference = next
        applyTheme({ ...readTheme(), enabled: false })
      }
    }
  }

  function setMode(next: DisplayMode) {
    apply(next)
    // ThemeEditor 卸载时会恢复已保存主题；等它卸载后再关闭。
    if (next !== 'custom' && import.meta.client) {
      nextTick(() => applyTheme({ ...readTheme(), enabled: false }))
    }
  }

  onMounted(() => {
    if (initialized) return
    initialized = true
    const saved = normalizeMode(localStorage.getItem(DISPLAY_MODE_KEY))
    const inferred = normalizeMode(colorMode.preference)
    const next = localStorage.getItem(DISPLAY_MODE_KEY) ? saved : inferred
    mode.value = next
    if (next === 'custom') {
      colorMode.preference = 'light'
      applyTheme(readTheme())
    } else {
      colorMode.preference = next
      applyTheme({ ...readTheme(), enabled: false })
    }
  })

  return { mode, setMode }
}
