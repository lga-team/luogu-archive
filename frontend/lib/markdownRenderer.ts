import { renderMarkdown } from '@luogu-saver-next/markdown-renderer'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective)
const archiveHosts = new Set([
  'www.luogu.com.cn', 'luogu.com.cn', 'www.luogu.com', 'luogu.com',
  'www.luogu.org', 'luogu.org', 'www.luogu.ac.cn', 'luogu.ac.cn',
])
const archivePaths = ['/article/', '/paste/', '/discuss/', '/user/', '/judgement', '/feed']

interface SyntaxNode {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: SyntaxNode[]
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// 保留原来的 html:false 约束；按语法树识别 HTML，不误伤代码、公式和自动链接。
function escapeRawHtml(source: string): string {
  const tree = parser.parse(source)
  const ranges: Array<{ start: number; end: number }> = []
  function visit(node: SyntaxNode) {
    if (node.type === 'html') {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) ranges.push({ start, end })
    }
    node.children?.forEach(visit)
  }
  visit(tree)
  let escaped = source
  for (const { start, end } of ranges.sort((a, b) => b.start - a.start)) {
    escaped = escaped.slice(0, start) + escapeHtml(source.slice(start, end)) + escaped.slice(end)
  }
  return escaped
}

interface DomContext {
  document: Document
  purifier: { sanitize: (html: string, options: Record<string, unknown>) => string | DocumentFragment }
}

let domPromise: Promise<DomContext> | undefined

async function getDom(): Promise<DomContext> {
  if (!domPromise) {
    domPromise = (async () => {
      if (import.meta.server) {
        const [{ parseHTML }, { default: createDOMPurify }] = await Promise.all([
          import('linkedom'),
          import('dompurify'),
        ])
        const { window } = parseHTML('<!doctype html><html><body></body></html>')
        return {
          document: window.document as unknown as Document,
          purifier: createDOMPurify(window as any) as unknown as DomContext['purifier'],
        }
      }
      const { default: DOMPurify } = await import('dompurify')
      return { document, purifier: DOMPurify as unknown as DomContext['purifier'] }
    })().catch(error => {
      domPromise = undefined
      throw error
    })
  }
  return domPromise
}

function adaptHtml(html: string, dom: DomContext): string {
  const sanitized = dom.purifier.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling'],
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'object', 'embed', 'video', 'audio'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
  })
  const container = dom.document.createElement('div')
  container.innerHTML = String(sanitized)
  const fragment = container

  fragment.querySelectorAll<HTMLIFrameElement>('iframe').forEach(frame => {
    try {
      const url = new URL(frame.getAttribute('src') || '')
      if (url.origin !== 'https://player.bilibili.com' || url.pathname !== '/player.html') {
        frame.remove()
        return
      }
      url.searchParams.set('autoplay', '0')
      frame.src = url.href
      frame.title = '哔哩哔哩视频'
      frame.loading = 'lazy'
      frame.referrerPolicy = 'no-referrer'
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
      frame.setAttribute('allow', 'fullscreen; picture-in-picture')
      frame.setAttribute('allowfullscreen', '')
      frame.parentElement?.classList.add('lg-bilibili-frame')
    } catch { frame.remove() }
  })
  fragment.querySelectorAll('.bilibili-video-container').forEach(el => el.classList.add('lg-bilibili'))

  fragment.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    const href = anchor.getAttribute('href') || ''
    if (href.startsWith('#')) {
      try {
        const id = 'user-content-' + decodeURIComponent(href.slice(1))
        if (Array.from(fragment.querySelectorAll('[id]')).some(el => el.id === id)) anchor.setAttribute('href', '#' + encodeURIComponent(id))
      } catch { /* 保留无法解码的原始锚点。 */ }
    }
    if (!/^https?:\/\//i.test(href)) return
    try {
      const url = new URL(href)
      if (archiveHosts.has(url.hostname.toLowerCase())
        && (url.pathname === '/' || archivePaths.some(path => url.pathname.startsWith(path)))) {
        anchor.setAttribute('href', url.pathname + url.search + url.hash)
      } else {
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }
    } catch { anchor.removeAttribute('href') }
  })
  fragment.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    image.loading = 'lazy'
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
  })

  fragment.querySelectorAll<HTMLElement>('.md-block').forEach(block => {
    const title = Array.from(block.children).find(el => el.classList.contains('md-block-title'))
    const body = Array.from(block.children).find(el => el.classList.contains('md-block-body'))
    if (!title || !body) return
    const details = dom.document.createElement('details')
    const kind = ['info', 'warning', 'success', 'error'].find(name => block.classList.contains(name)) || 'info'
    details.className = `lg-callout lg-callout-${kind}`
    details.open = (body as HTMLElement).style.display !== 'none'
    const summary = dom.document.createElement('summary')
    title.querySelectorAll('.toggle-btn').forEach(icon => icon.remove())
    summary.append(...Array.from(title.childNodes))
    body.removeAttribute('style')
    details.append(summary, body)
    block.replaceWith(details)
  })
  fragment.querySelectorAll('.md-epigraph').forEach(el => el.classList.add('lg-epigraph'))
  fragment.querySelectorAll('.epigraph-author').forEach(el => el.classList.add('lg-epigraph-source'))
  fragment.querySelectorAll<HTMLElement>('[class*="md-align-"]').forEach(el => {
    const align = ['left', 'center', 'right'].find(value => el.classList.contains(`md-align-${value}`))
    if (align) {
      el.classList.add('lg-align')
      el.style.textAlign = align
    }
  })
  fragment.querySelectorAll('.table-container').forEach(el => el.classList.add('lg-table-scroll'))
  fragment.querySelectorAll('table.cute-table').forEach(el => el.classList.add('lg-cute-table'))
  fragment.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(el => {
    el.disabled = true
    el.classList.add('lg-task-checkbox')
    el.closest('li')?.classList.add('lg-task-list')
  })
  fragment.querySelectorAll('pre').forEach(pre => {
    pre.classList.add('lg-code-block')
    const lines = pre.querySelectorAll('code > .line')
    lines.forEach((line, index) => {
      line.classList.add('lg-code-line')
      line.setAttribute('data-line', String(index + 1))
    })
    if (lines.length) pre.classList.add('has-line-numbers')
  })
  return container.innerHTML
}

export async function renderArchiveMarkdown(source: string): Promise<string> {
  const html = await renderMarkdown(escapeRawHtml(source))
  try {
    const dom = await getDom()
    return adaptHtml(html, dom)
  } catch (error) {
    // 后处理失败时仍返回可读的 Markdown 主体，避免整块内容变成错误提示。
    console.error('[Markdown] HTML 适配失败，回退到基础渲染', error)
    return html
  }
}
