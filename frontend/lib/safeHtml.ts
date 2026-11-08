/**
 * v-html 输出前的 HTML 白名单过滤。
 *
 * - 过滤器使用 DOMPurify（成熟、维护中的白名单库），不用正则自行实现 HTML 安全过滤。
 * - 服务端用 jsdom 提供 DOM、客户端用浏览器 DOM，过滤配置完全一致，
 *   两侧都执行同样的过滤，保证 SSR 与客户端水合内容一致。
 *   （jsdom 是 DOMPurify 官方支持的服务端 DOM；linkedom 缺少
 *   document.implementation 会让 DOMPurify 静默放行，不能使用。）
 * - 默认禁止原始 HTML：脚本、事件属性、危险协议、可执行嵌入、<style> 一律移除；
 *   仅保留 Markdown 渲染、KaTeX 公式、代码块、任务框、表格合并、提示块、
 *   合法图片链接所需的标签与属性。
 * - B 站嵌入只放行精确的 https://player.bilibili.com/player.html，
 *   按 origin + pathname 精确比对，不做域名子串匹配。
 */

type Purifier = {
  isSupported?: boolean
  sanitize: (html: string, options: Record<string, unknown>) => string | DocumentFragment
}

interface DomContext {
  document: Document
  purifier: Purifier
}

const BILIBILI_PLAYER_ORIGIN = 'https://player.bilibili.com'
const BILIBILI_PLAYER_PATH = '/player.html'

const SAFE_CONFIG: Record<string, unknown> = {
  USE_PROFILES: { html: true, svg: true, mathMl: true },
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'frameborder',
    'scrolling',
    'loading',
    'target',
    'rel',
    'role',
    'tabindex',
    'data-line',
    'data-uid',
  ],
  FORBID_TAGS: [
    'style',
    'form',
    'button',
    'textarea',
    'select',
    'object',
    'embed',
    'video',
    'audio',
  ],
  ALLOW_DATA_ATTR: false,
}

let context: DomContext | null = null
let initPromise: Promise<void> | null = null

/** 预加载过滤器（Nuxt 插件在渲染前 await）；服务端/客户端各取自己的 DOM 实现。 */
export function initSafeHtml(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (typeof document === 'undefined') {
        // @ts-ignore - jsdom 没有类型
        const jsdom = await import('jsdom')
        const { default: createDOMPurify } = await import('dompurify')
        const { window } = new jsdom.JSDOM('<!doctype html><html><body></body></html>')
        context = {
          document: window.document as unknown as Document,
          purifier: createDOMPurify(window as never) as unknown as Purifier,
        }
      } else {
        const { default: DOMPurify } = await import('dompurify')
        context = { document, purifier: DOMPurify as unknown as Purifier }
      }
    })().catch((error) => {
      initPromise = null
      throw error
    })
  }
  return initPromise
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function harden(html: string, dom: DomContext): string {
  const sanitized = String(dom.purifier.sanitize(html, SAFE_CONFIG))
  const container = dom.document.createElement('div')
  container.innerHTML = sanitized

  container.querySelectorAll('iframe').forEach((frame) => {
    try {
      const url = new URL(frame.getAttribute('src') || '')
      if (url.origin !== BILIBILI_PLAYER_ORIGIN || url.pathname !== BILIBILI_PLAYER_PATH) {
        frame.remove()
        return
      }
      url.searchParams.set('autoplay', '0')
      frame.removeAttribute('srcdoc')
      frame.setAttribute('src', url.href)
      frame.setAttribute('title', '哔哩哔哩视频')
      frame.setAttribute('loading', 'lazy')
      frame.setAttribute('referrerpolicy', 'no-referrer')
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
      frame.setAttribute('allow', 'fullscreen; picture-in-picture')
      frame.setAttribute('allowfullscreen', '')
    } catch {
      frame.remove()
    }
  })

  container.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    }
  })

  return container.innerHTML
}

/** 过滤一段待写入 v-html 的 HTML；调用前必须先 await initSafeHtml()。 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  // DOMPurify 在 DOM 不受支持时会静默原样返回输入，必须显式失败关闭
  if (!context || context.purifier.isSupported !== true) {
    console.error('[Markdown] HTML 过滤器不可用，输出已转义的纯文本')
    return escapeHtml(html)
  }
  return harden(html, context)
}
