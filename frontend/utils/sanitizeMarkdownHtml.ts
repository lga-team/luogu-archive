import { fromHtml } from 'hast-util-from-html'
import { sanitize, type Schema } from 'hast-util-sanitize'
import { toHtml } from 'hast-util-to-html'

const mathTags = [
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext',
  'mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup', 'munder', 'mover',
  'munderover', 'mtable', 'mtr', 'mtd', 'mstyle', 'mspace', 'mpadded', 'mphantom', 'menclose',
]
const alignment = /^text-align:\s*(?:left|center|right);?$/
const classes = /^[a-z0-9_-]{1,96}$/i
const playerSandbox = ['allow-scripts', 'allow-same-origin', 'allow-presentation']
const schema: Schema = {
  tagNames: [
    'a', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em', 'footer',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'iframe', 'img', 'input', 'li',
    'ol', 'p', 'pre', 's', 'span', 'strong', 'summary', 'table', 'tbody', 'td',
    'th', 'thead', 'tr', 'ul', 'svg', 'path', 'line', ...mathTags,
  ],
  strip: ['script', 'style', 'noscript', 'template', 'foreignObject', 'annotation-xml'],
  ancestors: {
    tbody: ['table'], td: ['table'], th: ['table'], thead: ['table'], tr: ['table'],
    path: ['svg'], line: ['svg'], annotation: ['math'],
  },
  attributes: {
    '*': [['className', classes], 'title'],
    a: ['href', ['target', '_blank'], ['rel', 'noopener', 'noreferrer'], ['dataUid', /^\d+$/]],
    details: ['open'],
    div: [['style', alignment], ['tabIndex', 0]],
    span: ['ariaLabel', 'ariaHidden', ['role', 'group', 'tooltip'], ['tabIndex', 0], ['dataLine', /^\d+$/], 'style'],
    img: ['src', 'alt'],
    iframe: ['src', ['loading', 'lazy'], ['allow', 'fullscreen; picture-in-picture'], 'allowFullScreen', ['sandbox', ...playerSandbox], ['referrerPolicy', 'no-referrer']],
    input: ['checked'],
    ol: ['start'],
    td: ['colSpan', 'rowSpan', ['style', alignment]],
    th: ['colSpan', 'rowSpan', ['style', alignment]],
    math: [['xmlns', 'http://www.w3.org/1998/Math/MathML'], ['display', 'block', 'inline']],
    annotation: [['encoding', 'application/x-tex']],
    mi: ['mathvariant'],
    mo: ['fence', 'stretchy', 'symmetric', 'minsize', 'maxsize', 'lspace', 'rspace', 'form', 'separator'],
    mfrac: ['linethickness'],
    mtable: ['rowspacing', 'columnalign', 'columnspacing', 'rowalign'],
    mtd: ['columnalign', 'rowalign'],
    mstyle: ['scriptlevel', 'displaystyle', 'mathcolor'],
    mover: ['accent'],
    munder: ['accentunder'],
    munderover: ['accent', 'accentunder'],
    mpadded: ['width', 'height', 'depth', 'lspace', 'voffset'],
    mspace: ['width', 'height', 'depth', 'mathbackground'],
    menclose: ['notation'],
    svg: [['xmlns', 'http://www.w3.org/2000/svg'], 'width', 'height', 'viewBox', 'preserveAspectRatio'],
    path: ['d'],
    line: ['x1', 'y1', 'x2', 'y2', 'strokeWidth'],
  },
  protocols: { href: ['http', 'https', 'mailto', 'tel', 'ftp', 'irc', 'ircs', 'xmpp'], src: ['http', 'https'] },
  required: { input: { disabled: true, type: 'checkbox' } },
}

const size = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|pt|%)?$|^auto$/i
const color = /^(?:#[\da-f]{3,8}|[a-z]{1,24})$/i
const sizeProperties = /^(?:(?:min-)?(?:width|height)|top|right|bottom|left|vertical-align|(?:margin|padding)(?:-(?:top|right|bottom|left))?|border(?:-(?:top|right|bottom|left))?-width)$/

function safeMathStyle(style: string): string {
  return style.split(';').flatMap(declaration => {
    const [key, value, extra] = declaration.split(':').map(part => part.trim())
    if (!key || !value || extra !== undefined) return []
    const parts = value.split(/\s+/)
    const allowed = (sizeProperties.test(key) && parts.length <= 4 && parts.every(part => size.test(part)))
      || (/^(?:color|border-color|background-color)$/.test(key) && color.test(value))
      || (/^border(?:-(?:top|right|bottom|left))?-style$/.test(key) && /^(?:solid|dashed|dotted)$/.test(value))
      || (key === 'position' && value === 'relative')
      || (key === 'text-shadow' && value === '0.02em 0.01em 0.04px')
    return allowed ? [`${key}:${value}`] : []
  }).join(';')
}

type HtmlParent = Pick<ReturnType<typeof fromHtml>, 'children'>

function restrictProperties(parent: HtmlParent, inMath = false): void {
  parent.children = parent.children.filter(node => {
    if (node.type !== 'element') return true
    const props = node.properties
    if (node.tagName === 'iframe') {
      if (typeof props.src !== 'string') return false
      let url: URL
      try {
        url = new URL(props.src)
      } catch {
        return false
      }
      if (url.origin !== 'https://player.bilibili.com' || url.pathname !== '/player.html' || url.username || url.password) return false
      props.src = url.href
      props.sandbox = playerSandbox
      props.referrerPolicy = 'no-referrer'
      node.children = []
      return true
    }
    if (node.tagName === 'a' && props.target === '_blank') props.rel = ['noopener', 'noreferrer']
    const katex = inMath || (node.tagName === 'span' && Array.isArray(props.className) && props.className.includes('katex'))
    if (node.tagName === 'span' && typeof props.style === 'string') {
      const style = katex ? safeMathStyle(props.style) : ''
      if (style) props.style = style
      else delete props.style
    }
    restrictProperties(node, katex)
    return true
  })
}

export function sanitizeMarkdownHtml(html: string): string {
  if (!html) return ''
  const tree = fromHtml(html, { fragment: true })
  restrictProperties(tree)
  return toHtml(sanitize(tree, schema))
}
