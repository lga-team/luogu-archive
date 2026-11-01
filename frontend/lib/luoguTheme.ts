// 主题工具仅显式导入，避免 Nuxt 自动扫描把嵌套配置字段误识别为导出。
export interface ThemeConfig {
  lNavi: { back: string; fore: string; logo: string | null }
  lBody: {
    back: string; color: string[]; image: string; blur: 0 | 1000 | 1010; fade: number
    midOpts: { degree: number; brightness: number; repeat: string; size: string; position: number[] }
  }
}
export interface SavedTheme { name: string; config: ThemeConfig; enabled: boolean; sourceId?: number; author?: string }
export interface ThemeResult { id: number; status: 'pending' | 'ready' | 'error'; name: string; author_name: string; config: unknown; error?: string }
export const THEME_KEY = 'archive-luogu-theme-v1'
export const defaultTheme = (): SavedTheme => ({ name: '自定义主题', enabled: false, config: {
  lNavi: { back: '#ffffff', fore: '#333333', logo: null },
  lBody: { back: '#efefef', color: [], image: '', blur: 0, fade: 0, midOpts: { degree: 0, brightness: 0, repeat: 'none', size: 'auto', position: [0, 0] } },
} })

function color(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100 || !/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|(?:rgb|hsl)a?\([\d.,%\s+/-]+\)|transparent|white|black)$/i.test(value.trim()) || !CSS.supports('color', value)) throw Error('颜色格式不正确')
  return value.trim()
}
function number(value: unknown, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw Error('主题数值超出范围')
  return value
}
export function imageUrl(value: string, date = new Date()): string {
  const parts: Record<string, number> = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), w: date.getDay() }
  const expanded = value.replace(/\{([ymdw])\}/g, (_, key) => String(parts[key]))
  const url = new URL(expanded)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)) throw Error('图片地址需为公开 HTTPS 链接')
  return expanded
}
export function normalizeTheme(value: unknown): ThemeConfig {
  if (!value || typeof value !== 'object') throw Error('主题配置格式不正确')
  const raw = value as any
  const defaults = defaultTheme().config
  const nav = raw.lNavi ?? defaults.lNavi, body = raw.lBody ?? defaults.lBody, opts = body.midOpts ?? {}
  const image = body.image || ''
  if (typeof image !== 'string' || image.length > 2048) throw Error('图片地址过长')
  if (image) imageUrl(image)
  const colors = body.color ?? []
  if (!Array.isArray(colors) || colors.length > 20) throw Error('最多支持 20 个中景颜色')
  const size = opts.size || 'auto', repeat = opts.repeat || 'none', position = opts.position ?? [0, 0]
  if (typeof size !== 'string' || !(/^(?:auto|cover|contain)$/.test(size) || /^\d{1,4}(?:\.\d+)?(?:\s+\d{1,4}(?:\.\d+)?)?$/.test(size))) throw Error('图片尺寸不正确')
  if (!['none', 'all', 'x', 'y'].includes(repeat) || !Array.isArray(position) || position.length !== 2) throw Error('图片设置不正确')
  const blur = body.blur ?? 0
  if (![0, 1000, 1010].includes(blur)) throw Error('毛玻璃档位不正确')
  // 洛谷使用 ±1000 表示淡出方向，本站编辑器使用 ±1；统一方向并兼容旧配置。
  const fade = Math.sign(number(body.fade ?? 0, -1000, 1000))
  return {
    lNavi: { back: color(nav.back ?? '#ffffff'), fore: color(nav.fore ?? '#333333'), logo: nav.logo ? color(nav.logo) : null },
    lBody: { back: color(body.back ?? '#efefef'), image, color: colors.filter(Boolean).map(color), blur,
      fade, midOpts: { degree: number(opts.degree ?? 0, 0, 360), brightness: number(opts.brightness ?? 0, -100, 100), repeat, size, position: position.map((v: unknown) => number(v, 0, 100)) } },
  }
}
export function readTheme(): SavedTheme {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY) || 'null')
    if (saved) return { name: String(saved.name || '自定义主题').slice(0, 100), enabled: saved.enabled === true, config: normalizeTheme(saved.config), sourceId: Number.isSafeInteger(saved.sourceId) ? saved.sourceId : undefined, author: typeof saved.author === 'string' ? saved.author.slice(0, 100) : undefined }
  } catch { /* 配置损坏或存储不可用时回退，不影响页面访问。 */ }
  return defaultTheme()
}
export function applyTheme(saved: SavedTheme) {
  const root = document.documentElement
  if (!saved.enabled) { delete root.dataset.archiveTheme; return }
  const { lNavi: nav, lBody: body } = normalizeTheme(saved.config)
  const opts = body.midOpts
  const colors = body.color.length === 1 ? [body.color[0], body.color[0]] : body.color
  const variables: Record<string, string> = {
    'nav-bg': nav.back, 'nav-fg': nav.fore, 'logo': nav.logo || 'currentColor',
    'body-bg': body.back, 'image': body.image ? `url(${JSON.stringify(imageUrl(body.image))})` : 'none',
    'gradient': colors.length ? `linear-gradient(${opts.degree}deg, ${colors.join(', ')})` : 'none',
    'repeat': ({ all: 'repeat', x: 'repeat-x', y: 'repeat-y' } as Record<string, string>)[opts.repeat] || 'no-repeat',
    'size': /^(auto|cover|contain)$/.test(opts.size) ? opts.size : opts.size.split(/\s+/).map(v => Number(v) === 0 ? 'auto' : `${v}%`).join(' '),
    'position': `${opts.position[0]}% ${opts.position[1]}%`,
    'brightness': `brightness(${100 + opts.brightness}%)`,
    'layer-position': body.fade === 0 ? 'fixed' : 'absolute',
    'layer-height': body.fade === 0 ? '100dvh' : '400px',
    'layer-top': body.fade < 0 ? 'auto' : '0px',
    'layer-bottom': body.fade < 0 ? '0px' : 'auto',
    'mask': body.fade > 0 ? 'linear-gradient(to bottom, #000 0, transparent 400px)' : body.fade < 0 ? 'linear-gradient(to top, #000 0, transparent 400px)' : 'none',
    'card': body.blur ? `rgba(255,255,255,${body.blur === 1010 ? '.8' : '.75'})` : '#ffffff',
    'blur': body.blur ? `blur(${body.blur === 1010 ? 2 : 10}px)` : 'none',
  }
  for (const [key, value] of Object.entries(variables)) root.style.setProperty(`--archive-theme-${key}`, value)
  root.dataset.archiveLogo = nav.logo ? 'mono' : 'color'
  root.dataset.archiveTheme = 'light'
  // 洛谷主题只有浅色一种，避免深色 token 让卡片文字变成白色。
  root.classList.remove('dark')
  root.style.colorScheme = 'light'
}
export async function prepareTheme(saved: SavedTheme): Promise<void> {
  normalizeTheme(saved.config)
  if (!saved.enabled || !saved.config.lBody.image) return
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    const finish = (error?: Error) => { window.clearTimeout(timer); image.onload = null; image.onerror = null; error ? reject(error) : resolve() }
    const timer = window.setTimeout(() => finish(Error('背景图片加载超时，可清除图片后应用')), 12000)
    image.onload = () => finish()
    image.onerror = () => finish(Error('背景图片加载失败，可清除图片后应用'))
    image.referrerPolicy = 'no-referrer'
    image.src = imageUrl(saved.config.lBody.image)
  })
}
export function saveTheme(saved: SavedTheme) {
  localStorage.setItem(THEME_KEY, JSON.stringify(saved))
  applyTheme(saved)
  window.dispatchEvent(new Event('archive-theme-saved'))
}
export function parseThemeId(value: string): number {
  let idText = value.trim()
  if (!/^[1-9]\d*$/.test(idText)) {
    let url: URL
    try { url = new URL(idText) }
    catch { throw Error('请输入有效的洛谷主题编号或主题链接') }
    const match = /^\/theme\/design\/([1-9]\d*)\/?$/.exec(url.pathname)
    if (url.protocol !== 'https:' || !['www.luogu.com.cn', 'luogu.com.cn', 'www.luogu.com', 'luogu.com'].includes(url.hostname) || url.port || url.username || url.password || !match) throw Error('请输入有效的洛谷主题编号或主题链接')
    idText = match[1]
  }
  const id = Number(idText)
  if (!Number.isSafeInteger(id)) throw Error('主题编号超出范围')
  return id
}
