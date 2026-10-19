// 犇犇正文渲染的唯一实现：Markdown + 回复链自动补回内容的标记。
// 补回标记的呈现全部用 Tailwind 类写在生成的 HTML 字符串里。
export function useFeedContent() {
  const { render } = useMarkdown()
  const completionTip = '此内容由洛谷档案馆根据回复链自动补全'

  const WRAP = 'feed-completion-wrap group relative inline cursor-help outline-none'
  const WRAP_BLOCK = 'feed-completion-wrap feed-completion-block group relative block w-fit max-w-full cursor-help outline-none'
  const POPOVER = 'feed-completion-popover pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-20 hidden w-max max-w-[260px] rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs leading-normal text-muted-foreground shadow-md group-hover:block group-focus-within:block'
  const DASHED = 'border-b border-dashed border-border'
  const DASHED_IMG = '[&_img]:rounded [&_img]:border [&_img]:border-dashed [&_img]:border-border [&_img]:align-middle'

  function markMergedMedia(html: string, links: string[], images: string[]) {
    let marked = html
    for (const link of links) {
      const anchor = render(link).match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
      if (!anchor || !marked.includes(anchor)) continue
      marked = marked.replace(
        anchor,
        `<span class="${WRAP}" tabindex="0"><span class="${DASHED}">${anchor}</span><span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`,
      )
    }
    for (const imageMd of images) {
      const image = render(imageMd).match(/<img\b[^>]*>/i)?.[0]
      if (!image || !marked.includes(image)) continue
      marked = marked.replace(
        image,
        `<span class="${WRAP} inline-block max-w-full ${DASHED_IMG}" tabindex="0">${image}<span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`,
      )
    }
    return marked
  }

  function renderMergedSuffix(content: string, mergedSuffix: string) {
    const prefix = content.slice(0, Math.max(0, content.length - mergedSuffix.length))
    const prefixHtml = render(prefix)
    const suffixHtml = render(mergedSuffix)
    const suffixParagraph = suffixHtml.match(/^<p>([\s\S]*)<\/p>\s*$/)

    // 普通文字尾巴接回原段落；只有原 Markdown 明确换行或包含多个块时才另起一行。
    if (!mergedSuffix.startsWith('\n') && suffixParagraph && /<\/p>\s*$/.test(prefixHtml)) {
      const markedSuffix = `<span class="${WRAP}" tabindex="0"><span class="${DASHED}">${suffixParagraph[1]}</span><span class="${POPOVER}" role="tooltip">${completionTip}</span></span>`
      return prefixHtml.replace(/<\/p>\s*$/, `${markedSuffix}</p>`)
    }

    return prefixHtml
      + `<div class="${WRAP_BLOCK} my-1.5" tabindex="0"><div class="${DASHED} [&_img]:max-w-full [&_img]:align-middle">${suffixHtml}</div><span class="${POPOVER}" role="tooltip">${completionTip}</span></div>`
  }

  function feedHtml(
    content: string,
    mergedSuffix?: string | null,
    mergedLinks: string[] = [],
    mergedImages: string[] = [],
  ) {
    let html = mergedSuffix
      ? renderMergedSuffix(content, mergedSuffix)
      : render(content)
    if (mergedLinks.length || mergedImages.length) {
      html = markMergedMedia(html, mergedLinks, mergedImages)
    }
    return html
  }

  return { feedHtml }
}
