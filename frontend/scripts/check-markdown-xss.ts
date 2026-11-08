// @ts-nocheck - 独立回归脚本（tsx 运行），jsdom/node 类型不参与应用类型检查
/**
 * Markdown 渲染 XSS 回归检查（只在本地运行，不连接线上环境）。
 *
 * 运行：npx tsx scripts/check-markdown-xss.ts
 *
 * 覆盖：恶意内容位于用户提及之前 / 之后 / 两次提及之间、实体编码、重复渲染、
 * 提示块标题、引言作者、表格、任务项、犇犇补全（后缀 / 链接 / 图片），
 * 并验证正常 Markdown、KaTeX、代码块、任务框、表格合并、提示块、
 * 合法图片链接与 B 站嵌入仍然保留。
 *
 * 提及语法说明：`@[name](/user/uid)` 在文本 token 中出现时（例如经字符引用
 * `@&#91;name&#93;(/user/uid)` 或转义 `@\[name\](/user/uid)` 形式）由自定义
 * 文本渲染器处理；普通写法则由 markdown-it 链接语法渲染。两条路径都必须安全。
 */
import { JSDOM } from 'jsdom'
import { initSafeHtml, sanitizeHtml } from '../lib/safeHtml'
import { useMarkdown } from '../composables/useMarkdown'

// useFeedContent 依赖 Nuxt 自动导入的 useMarkdown，这里用全局接上同一实现
;(globalThis as Record<string, unknown>).useMarkdown = useMarkdown
const { useFeedContent } = await import('../composables/useFeedContent')

await initSafeHtml()
const { render } = useMarkdown()
const { feedHtml } = useFeedContent()

let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    return
  }
  failed++
  failures.push(`${name}${detail ? ` :: ${detail}` : ''}`)
}

interface Issue {
  kind: string
  detail: string
}

function auditHtml(name: string, html: string) {
  const issues: Issue[] = []
  const { window } = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
  const { document } = window
  document.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'object', 'embed', 'form', 'button', 'textarea', 'select', 'video', 'audio'].includes(tag)) {
      issues.push({ kind: 'forbidden-tag', detail: `<${tag}>` })
    }
    if (tag === 'iframe') {
      try {
        const url = new URL(el.getAttribute('src') || '')
        if (url.origin !== 'https://player.bilibili.com' || url.pathname !== '/player.html') {
          issues.push({ kind: 'iframe-not-whitelisted', detail: el.getAttribute('src') || '' })
        }
      } catch {
        issues.push({ kind: 'iframe-bad-src', detail: el.getAttribute('src') || '' })
      }
    }
    for (const attr of Array.from(el.attributes)) {
      const attrName = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (attrName.startsWith('on')) {
        issues.push({ kind: 'event-attr', detail: `${tag}[${attrName}]` })
      }
      if (attrName === 'srcdoc') {
        issues.push({ kind: 'srcdoc', detail: tag })
      }
      if (['href', 'src', 'xlink:href', 'action', 'formaction', 'data'].includes(attrName)
        && (value.startsWith('javascript:') || value.startsWith('vbscript:'))) {
        issues.push({ kind: 'dangerous-protocol', detail: `${tag}[${attrName}]="${attr.value}"` })
      }
    }
  })
  check(name, issues.length === 0, issues.map(issue => `${issue.kind}:${issue.detail}`).join(', '))
}

const mentionOk = (html: string, uid: string, name: string) =>
  html.includes(`<a class="lg-user-mention" href="/user/${uid}" data-uid="${uid}">@${name}</a>`)

const userLinkOk = (html: string, uid: string) =>
  html.includes(`href="/user/${uid}"`)

// 文本 token 形式的提及（字符引用 / 转义写法），是自定义文本渲染器的触发路径
const MENTION_A = '@&#91;alice&#93;(/user/1)'
const MENTION_B = '@&#91;bob&#93;(/user/2)'

// ---------- 攻击载荷：提及相邻的原始 HTML ----------
const attackCases: Array<[string, string]> = [
  ['提及之前的恶意 HTML', `<img src=x onerror="window.__x=1"> ${MENTION_A}`],
  ['提及之后的恶意 HTML', `${MENTION_A} <img src=x onerror="window.__x=1">`],
  ['两次提及之间的恶意 HTML', `${MENTION_A} <svg onload="window.__x=1"> ${MENTION_B}`],
  ['实体编码的恶意 HTML', `&lt;img src=x onerror="window.__x=1"&gt; ${MENTION_A}`],
  ['转义写法提及 + 恶意 HTML', `<img src=x onerror="window.__x=1"> @\\[alice\\](/user/1)`],
  ['普通写法提及 + 恶意 HTML', `<img src=x onerror="window.__x=1"> @[alice](/user/1)`],
  ['用户名中的恶意 HTML', `@&#91;&lt;img src=x onerror="window.__x=1"&gt;&#93;(/user/1)`],
  ['用户名中的标签闭合', `@&#91;a&lt;/a&gt;&lt;script&gt;window.__x=1&lt;/script&gt;&#93;(/user/1)`],
  ['用户名中的引号逃逸', `@&#91;a" onmouseover="window.__x=1&#93;(/user/1)`],
  ['script 标签', `<script>window.__x=1</script> ${MENTION_A}`],
  ['iframe srcdoc', `${MENTION_A}<iframe srcdoc="&lt;script&gt;window.__x=1&lt;/script&gt;"></iframe>`],
  ['javascript 链接', `[点我](javascript:window.__x=1) ${MENTION_A}`],
  ['data:text/html 图片', `![](data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194PTE8L3NjcmlwdD4=) ${MENTION_A}`],
  ['自动链接形式的伪协议', `<javascript:window.__x=1> ${MENTION_A}`],
]

for (const [name, source] of attackCases) {
  auditHtml(`普通渲染：${name}`, render(source))
}

// 提示块标题 / 正文
auditHtml('提示块标题携带恶意内容', render(`:::info[<img src=x onerror="window.__x=1"> ${MENTION_A}]\n正文 <img src=x onerror="window.__x=1">\n:::`))
// 引言署名
auditHtml('引言署名携带恶意内容', render(`:::epigraph[——<img src=x onerror="window.__x=1"> ${MENTION_A}]\n引言 <svg onload="window.__x=1">\n:::`))
// 表格
auditHtml('表格单元格携带恶意内容', render(`| a | b |\n| - | - |\n| <img src=x onerror="window.__x=1"> | ${MENTION_A} |`))
// 任务项
auditHtml('任务项携带恶意内容', render(`- [x] <img src=x onerror="window.__x=1"> ${MENTION_A}\n- [ ] <svg onload="window.__x=1">`))
// 对齐块
auditHtml('对齐块携带恶意内容', render(`:::align{center}\n<img src=x onerror="window.__x=1"> ${MENTION_A}\n:::`))
// 代码块内载荷保持转义（不能执行，也不应被提及语法破坏）
{
  const html = render('```\n<img src=x onerror="window.__x=1"> @&#91;alice&#93;(/user/1)\n```')
  auditHtml('代码块携带恶意内容', html)
  check('代码块载荷保持字面文本', html.includes('&lt;img') || !html.includes('<img'))
}

// ---------- 犇犇补全（渲染后再次拼接） ----------
auditHtml(
  '犇犇补全后缀携带恶意内容',
  feedHtml(
    `前缀 ${MENTION_A} <img src=x onerror="window.__x=1">`,
    `尾巴 <img src=x onerror="window.__x=1"> ${MENTION_B}`,
  ),
)
auditHtml(
  '犇犇补全链接携带恶意内容',
  feedHtml(
    `正文 ${MENTION_A}`,
    null,
    ['[点我](javascript:window.__x=1)', '![x](x" onerror="window.__x=1)', `<img src=x onerror="window.__x=1"> ${MENTION_B}`],
    [],
  ),
)
auditHtml(
  '犇犇补全图片携带恶意内容',
  feedHtml(
    `正文 ${MENTION_A}`,
    null,
    [],
    ['![](data:text/html;base64,PHNjcmlwdD4=)', `<svg onload="window.__x=1"> ![y](https://example.com/y.png)`],
  ),
)
auditHtml(
  '犇犇补全多段后缀携带恶意内容',
  feedHtml(
    `前缀 <img src=x onerror="window.__x=1"> ${MENTION_A} 中段`,
    `\n\n第二段 <img src=x onerror="window.__x=1"> ${MENTION_B} <iframe srcdoc="x"></iframe>`,
    ['[](javascript:window.__x=1)'],
    ['![](x" onerror="window.__x=1)'],
  ),
)

// ---------- 重复渲染一致 ----------
{
  const source = `前缀 ${MENTION_A} <img src=x onerror="window.__x=1"> 尾巴`
  check('重复渲染结果一致', render(source) === render(source))
  const suffix = '补全 <img src=x onerror=1> @&#91;bob&#93;(/user/2)'
  const links = ['[](javascript:alert(1))']
  const images = ['![](x" onerror="1)']
  check('犇犇补全重复渲染结果一致',
    feedHtml(source, suffix, links, images) === feedHtml(source, suffix, links, images))
}

// ---------- 直接过滤器兜底 ----------
auditHtml('过滤器兜底', sanitizeHtml('<img src=x onerror="window.__x=1"><script>window.__x=1</script><iframe srcdoc="x"></iframe><a href="javascript:1">x</a>'))

// ---------- 正常功能保留 ----------
{
  const html = render('# 标题\n\n**粗** *斜* ~~删~~ [链接](https://example.com/a) ![图](https://example.com/a.png)')
  check('标题/强调/链接/图片保留',
    html.includes('<h1')
    && html.includes('<strong>')
    && html.includes('<em>')
    && html.includes('<s>')
    && html.includes('<img src="https://example.com/a.png"')
    && /<a[^>]+href="https:\/\/example\.com\/a"/.test(html))
  check('外链加安全属性', html.includes('rel="noopener noreferrer"') && html.includes('target="_blank"'))
}
{
  const html = render('行内公式 $a^2+b^2=c^2$ 与块级公式\n\n$$\\int_0^1 x\\,dx$$\n')
  check('KaTeX 公式保留', html.includes('katex') && (html.includes('katex-mathml') || html.includes('katex-html')))
  check('KaTeX 内联样式保留', html.includes('style='))
}
{
  const html = render('```cpp line-numbers lines=2\nint main() {}\nint x = 1;\n```')
  check('代码块/行号/高亮行保留',
    html.includes('lg-code-block')
    && html.includes('has-line-numbers')
    && html.includes('data-line="2"')
    && html.includes('lg-code-line')
    && html.includes('language-cpp'))
}
{
  const html = render('- [x] 完成\n- [ ] 未完成')
  check('任务框保留', html.includes('lg-task-checkbox') && html.includes('checked') && html.includes('disabled'))
}
{
  const html = render('| a | b | c |\n| - | - | - |\n| 1 | 2 | < |\n| 3 | ^ | ^ |\n\n::cute-table{tuack}\n| a | b |\n| - | - |\n| 1 | 2 |')
  check('表格合并保留', (html.includes('colspan="2"') || html.includes('rowspan="2"')) && html.includes('lg-cute-table'))
  check('表格滚动容器保留', html.includes('lg-table-scroll'))
}
{
  const html = render(':::info[标题]{open}\n内容\n:::\n')
  check('提示块保留', html.includes('<details') && html.includes('lg-callout-info') && html.includes('open') && html.includes('<summary>') && html.includes('标题'))
}
{
  const html = render(':::epigraph[——作者名]\n引言正文\n:::\n')
  check('引言保留', html.includes('lg-epigraph') && html.includes('lg-epigraph-source') && html.includes('作者名'))
}
{
  const html = render(':::align{center}\n居中\n:::\n')
  check('对齐块保留', html.includes('lg-align') && html.includes('text-align:center'))
}
{
  const html = render('![](bilibili:BV1xx411c7mD)')
  check('B 站嵌入保留',
    html.includes('https://player.bilibili.com/player.html?')
    && html.includes('bvid=BV1xx411c7mD')
    && html.includes('autoplay=0'))
}
{
  // URLSearchParams 解码后的属性逃逸载荷（真实的 B 站嵌入注入面）
  const html = render('![](bilibili:BVxxxxxxxxxx?page=%22%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E)')
  auditHtml('B 站嵌入参数注入审计', html)
  check('B 站嵌入参数注入被拦截', !html.includes('onerror=window.__x') || html.includes('onerror%3D'))
}
{
  const html = render('正文[^1]\n\n[^1]: 注释内容')
  check('脚注保留', html.includes('footnote'))
}
{
  const html = render(`\`@&#91;alice&#93;(/user/1)\` 与 ${MENTION_A} 与 @[alice](/user/1)`)
  check('提及生成受控链接', mentionOk(html, '1', 'alice'))
  check('普通写法提及生成受控链接', userLinkOk(html, '1'))
}
{
  const html = render(`:::info[你好 ${MENTION_A} 世界]{open}\n:::`)
  check('提示块标题中的提及受控', mentionOk(html, '1', 'alice'))
}
{
  const html = feedHtml('看看 [博客](https://blog.example.com/post) 的内容', null, ['[博客](https://blog.example.com/post)'], [])
  check('犇犇补全标记保留', html.includes('feed-completion-wrap') && html.includes('此内容由洛谷档案馆根据回复链自动补全'))
}

console.log(`\n通过 ${passed} 项，失败 ${failed} 项`)
if (failures.length) {
  console.log('失败明细：')
  for (const line of failures) console.log(`  - ${line}`)
  process.exit(1)
}
