// @ts-nocheck - 独立回归脚本（tsx 运行），jsdom/node 类型不参与应用类型检查
/**
 * Markdown 渲染 XSS 回归检查（只在本地运行，不连接线上环境）。
 *
 * 运行：npx tsx scripts/check-markdown-xss.ts
 *
 * 覆盖：B 站嵌入 URL 参数逃逸（percent / 字符引用编码、先闭合 iframe 再注入）、
 * 提及相邻的原始 HTML、实体编码、提示块标题、引言署名、表格、任务项、
 * 犇犇补全拼接（后缀 / 链接 / 图片），并验证正常 Markdown、KaTeX、代码块、
 * 任务框、表格合并、提示块、引言、对齐块、合法图片与 B 站嵌入仍然保留。
 */
import { JSDOM } from 'jsdom'
import { renderArchiveMarkdown } from '../lib/markdownRenderer'

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

function auditHtml(name: string, html: string) {
  const issues: string[] = []
  const { window } = new JSDOM(`<!doctype html><html><body>${html}</body></html>`)
  const { document } = window
  document.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'object', 'embed', 'form', 'button', 'textarea', 'select', 'video', 'audio'].includes(tag)) {
      issues.push(`forbidden-tag:<${tag}>`)
    }
    if (tag === 'iframe') {
      try {
        const url = new URL(el.getAttribute('src') || '')
        if (url.origin !== 'https://player.bilibili.com' || url.pathname !== '/player.html') {
          issues.push(`iframe-not-whitelisted:${el.getAttribute('src') || ''}`)
        }
      } catch {
        issues.push(`iframe-bad-src:${el.getAttribute('src') || ''}`)
      }
    }
    for (const attr of Array.from(el.attributes)) {
      const attrName = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (attrName.startsWith('on')) issues.push(`event-attr:${tag}[${attrName}]`)
      if (attrName === 'srcdoc') issues.push(`srcdoc:${tag}`)
      if (['href', 'src', 'xlink:href', 'action', 'formaction', 'data'].includes(attrName)
        && (value.startsWith('javascript:') || value.startsWith('vbscript:'))) {
        issues.push(`dangerous-protocol:${tag}[${attrName}]="${attr.value}"`)
      }
    }
  })
  check(name, issues.length === 0, issues.join(', '))
}

// ---------- 攻击载荷 ----------
const attackCases: Array<[string, string]> = [
  ['B站参数逃逸（percent，先闭合 iframe）',
    '![](bilibili:BVxxxxxxxxxx?page=%22%3E%3C/iframe%3E%3Cdiv%20style%3D%22position:fixed;inset:0%22%3E%E9%92%93%E9%B1%BC%3C/div%3E%3Ciframe%20src=%3D%22)'],
  ['B站参数逃逸（字符引用，先闭合 iframe）',
    '![](bilibili:BVxxxxxxxxxx&quot;&gt;&lt;/iframe&gt;&lt;div&#9;style=&quot;position:fixed&quot;&gt;X&lt;/div&gt;&lt;iframe&#9;src=&quot;)'],
  ['B站 t 参数逃逸（img onerror）',
    '![](bilibili:BV1xx411c7mD?t=%22%3E%3C/iframe%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E%3Ciframe%20src=%3D%22)'],
  ['B站 videoID 逃逸（aid 通道）',
    '![](bilibili:av123&quot;&gt;&lt;/iframe&gt;&lt;svg&#9;onload=window.__x=1&gt;&lt;iframe&#9;x=&quot;)'],
  ['提及之前的恶意 HTML', '<img src=x onerror="window.__x=1"> @[alice](/user/1)'],
  ['提及之后的恶意 HTML', '@[alice](/user/1) <img src=x onerror="window.__x=1">'],
  ['两次提及之间的恶意 HTML', '@[alice](/user/1) <svg onload="window.__x=1"> @[bob](/user/2)'],
  ['实体编码的恶意 HTML', '&lt;img src=x onerror="window.__x=1"&gt; @[alice](/user/1)'],
  ['用户名中的恶意 HTML', '@[<img src=x onerror="window.__x=1">](/user/1)'],
  ['script 标签', '<script>window.__x=1</script> @[alice](/user/1)'],
  ['iframe srcdoc', '<iframe srcdoc="&lt;script&gt;window.__x=1&lt;/script&gt;"></iframe>'],
  ['style 覆盖层', '<div style="position:fixed;inset:0">钓鱼</div>'],
  ['javascript 链接', '[点我](javascript:window.__x=1)'],
  ['data:text/html 图片', '![](data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194PTE8L3NjcmlwdD4=)'],
  ['伪协议自动链接', '<javascript:window.__x=1> @[alice](/user/1)'],
]

for (const [name, source] of attackCases) {
  auditHtml(`普通渲染：${name}`, await renderArchiveMarkdown(source))
}

auditHtml('提示块标题携带恶意内容', await renderArchiveMarkdown(':::info[<img src=x onerror="window.__x=1">]\n正文 <img src=x onerror="window.__x=1">\n:::'))
auditHtml('引言署名携带恶意内容', await renderArchiveMarkdown(':::epigraph[——<img src=x onerror="window.__x=1">]\n引言 <svg onload="window.__x=1">\n:::'))
auditHtml('表格单元格携带恶意内容', await renderArchiveMarkdown('| a | b |\n| - | - |\n| <img src=x onerror="window.__x=1"> | @[alice](/user/1) |'))
auditHtml('任务项携带恶意内容', await renderArchiveMarkdown('- [x] <img src=x onerror="window.__x=1"> @[alice](/user/1)\n- [ ] <svg onload="window.__x=1">'))
auditHtml('对齐块携带恶意内容', await renderArchiveMarkdown(':::align{center}\n<img src=x onerror="window.__x=1">\n:::'))

// ---------- 犇犇补全（渲染后再次拼接，与页面内 markMergedMedia / renderMergedSuffix 同构） ----------
const completionTip = '此内容由洛谷档案馆根据回复链自动补全'
const WRAP = 'feed-completion-wrap group relative inline cursor-help outline-none'
const POPOVER = 'feed-completion-popover'

async function feedHtml(content: string, mergedSuffix?: string | null, links: string[] = [], images: string[] = []) {
  let html = await renderArchiveMarkdown(content)
  if (mergedSuffix) {
    const prefixHtml = await renderArchiveMarkdown(content.slice(0, Math.max(0, content.length - mergedSuffix.length)))
    const suffixHtml = await renderArchiveMarkdown(mergedSuffix)
    const suffixParagraph = suffixHtml.match(/^<p>([\s\S]*)<\/p>\s*$/)
    if (!mergedSuffix.startsWith('\n') && suffixParagraph && /<\/p>\s*$/.test(prefixHtml)) {
      const markedSuffix = `<span class="${WRAP}" tabindex="0"><span>${suffixParagraph[1]}</span><span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`
      html = prefixHtml.replace(/<\/p>\s*$/, `${markedSuffix}</p>`)
    } else {
      html = prefixHtml + `<div class="${WRAP}" tabindex="0"><div>${suffixHtml}</div><span class="${POPOVER}" role="tooltip">${completionTip}</span></div>`
    }
  }
  for (const link of links) {
    const anchor = (await renderArchiveMarkdown(link)).match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
    if (!anchor || !html.includes(anchor)) continue
    html = html.replace(anchor, `<span class="${WRAP}" tabindex="0"><span>${anchor}</span><span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`)
  }
  for (const imageMd of images) {
    const image = (await renderArchiveMarkdown(imageMd)).match(/<img\b[^>]*>/i)?.[0]
    if (!image || !html.includes(image)) continue
    html = html.replace(image, `<span class="${WRAP}" tabindex="0">${image}<span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`)
  }
  return html
}

auditHtml('犇犇补全后缀携带恶意内容',
  await feedHtml('前缀 @[alice](/user/1) <img src=x onerror="window.__x=1">',
    '尾巴 <img src=x onerror="window.__x=1"> @[bob](/user/2)'))
auditHtml('犇犇补全链接携带恶意内容',
  await feedHtml('正文 @[alice](/user/1)', null,
    ['[点我](javascript:window.__x=1)', '![x](x" onerror="window.__x=1)'], []))
auditHtml('犇犇补全图片携带恶意内容',
  await feedHtml('正文 @[alice](/user/1)', null,
    [], ['![](data:text/html;base64,PHNjcmlwdD4=)', '![y](https://example.com/y.png)']))
auditHtml('犇犇补全多段后缀携带恶意内容',
  await feedHtml('前缀 <img src=x onerror="window.__x=1"> 中段',
    '\n\n第二段 <img src=x onerror="window.__x=1"> <iframe srcdoc="x"></iframe>'))

// ---------- 重复渲染一致 ----------
{
  const source = '前缀 @[alice](/user/1) <img src=x onerror="window.__x=1"> 尾巴'
  check('重复渲染结果一致', await renderArchiveMarkdown(source) === await renderArchiveMarkdown(source))
}

// ---------- 正常功能保留 ----------
{
  const html = await renderArchiveMarkdown('# 标题\n\n**粗** *斜* ~~删~~ [链接](https://example.com/a) ![图](https://example.com/a.png)')
  check('标题/强调/链接/图片保留',
    html.includes('<h1')
    && html.includes('<strong>')
    && html.includes('<em>')
    && html.includes('<del>')
    && html.includes('src="https://example.com/a.png"')
    && /<a[^>]+href="https:\/\/example\.com\/a"/.test(html))
}
{
  const html = await renderArchiveMarkdown('# 标题\n\n[跳转](#标题)')
  check('标题锚点可用', /id="[^"]*标题"/.test(html))
}
{
  const html = await renderArchiveMarkdown('行内公式 $a^2+b^2=c^2$ 与块级公式\n\n$$\\int_0^1 x\\,dx$$\n')
  check('KaTeX 公式保留', html.includes('katex') && (html.includes('katex-mathml') || html.includes('katex-html')))
  check('KaTeX 内联样式保留', html.includes('style='))
}
{
  const html = await renderArchiveMarkdown('```js\nconst x = 1;\n```')
  check('代码块保留', /<pre[^>]*class="[^"]*(shiki|lg-code-block)/.test(html) && html.includes('lg-code-line'))
}
{
  const html = await renderArchiveMarkdown('- [x] 完成\n- [ ] 未完成')
  check('任务框保留', html.includes('type="checkbox"') && html.includes('lg-task-checkbox'))
}
{
  const html = await renderArchiveMarkdown('| a | b | c |\n| - | - | - |\n| 1 | 2 | < |\n| 3 | ^ | ^ |')
  check('表格合并保留', html.includes('colspan="2"') || html.includes('rowspan="2"'))
}
{
  const html = await renderArchiveMarkdown('::cute-table{tuack}\n| a | b |\n| - | - |\n| 1 | 2 |')
  check('cute-table 保留', html.includes('lg-cute-table') && html.includes('lg-table-scroll'))
}
{
  const html = await renderArchiveMarkdown(':::info[标题]{open}\n内容\n:::\n')
  check('提示块保留', html.includes('lg-callout-info') && html.includes('open') && html.includes('<summary>') && html.includes('标题'))
}
{
  const html = await renderArchiveMarkdown(':::epigraph[——作者名]\n引言正文\n:::\n')
  check('引言保留', html.includes('lg-epigraph') && html.includes('lg-epigraph-source') && html.includes('作者名'))
}
{
  const html = await renderArchiveMarkdown(':::align{center}\n居中\n:::\n')
  check('对齐块保留', html.includes('lg-align') && /text-align:\s*center/.test(html))
}
{
  const html = await renderArchiveMarkdown('![](bilibili:BV1xx411c7mD)')
  check('B 站嵌入保留',
    html.includes('https://player.bilibili.com/player.html?')
    && html.includes('bvid=BV1xx411c7mD')
    && html.includes('autoplay=0')
    && html.includes('sandbox='))
}
{
  const html = await renderArchiveMarkdown('![](bilibili:BV1xx411c7mD?page=2&t=30)')
  check('B 站嵌入分P/进度参数保留', html.includes('page=2') && html.includes('t=30'))
}
{
  const html = await renderArchiveMarkdown('`@[alice](/user/1)` 与 @[alice](/user/1)')
  check('提及渲染为受控链接', /<a[^>]+href="\/user\/1"[^>]*>alice<\/a>/.test(html))
}
{
  const html = await renderArchiveMarkdown('<img src=x onerror="window.__x=1">')
  check('原始 HTML 保持转义', !/<img/i.test(html) || /&lt;img/i.test(html))
}

console.log(`\n通过 ${passed} 项，失败 ${failed} 项`)
if (failures.length) {
  console.log('失败明细：')
  for (const line of failures) console.log(`  - ${line}`)
  process.exit(1)
}
