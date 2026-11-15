/** 题解修：文章地址解析 + AI 修正 NDJSON 流读取。 */
const LUOGU_HOSTS = new Set([
  'www.luogu.com.cn', 'luogu.com.cn', 'www.luogu.com', 'luogu.com',
])

export function parseSolutionArticleId(input: string): string {
  let value = (input || '').trim()
  if (/^[A-Za-z0-9_-]{1,64}$/.test(value)) return value
  if (/^(?:www\.)?luogu\./i.test(value)) value = `https://${value}`
  if (/^https?:\/\//i.test(value)) {
    let url: URL
    try { url = new URL(value) }
    catch { throw new Error('文章地址格式不正确') }
    if (!LUOGU_HOSTS.has(url.hostname.toLowerCase())) throw new Error('只支持洛谷文章链接')
    value = url.pathname
  }
  const match = value.match(/^\/(?:article|atricle)\/([A-Za-z0-9_-]{1,64})\/?$/i)
  if (!match) throw new Error('支持 /article/{id}、洛谷文章链接或纯文章 ID')
  return match[1]
}

export interface FixStreamHandlers {
  model?: (value: string) => void
  thought?: (value: string) => void
  content?: (value: string) => void
  stage?: (value: string) => void
  done?: () => void
}

export async function readSolutionFixStream(response: Response, handlers: FixStreamHandlers = {}): Promise<string> {
  if (!response.ok || !response.body) {
    let message = `AI 修正失败（${response.status}）`
    try {
      const data = await response.json()
      message = data?.message || message
    } catch { /* 保留默认错误信息 */ }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''

  const handleLine = (line: string) => {
    if (!line.trim()) return
    let message: any
    try { message = JSON.parse(line) }
    catch { return }
    const data = String(message?.data ?? '')
    switch (message?.event) {
      case 'content': content += data; handlers.content?.(data); break
      case 'thought': handlers.thought?.(data); break
      case 'meta': handlers.model?.(data); break
      case 'stage': handlers.stage?.(data); break
      case 'done': handlers.done?.(); break
      case 'error': throw new Error(data || 'AI 修正失败')
      default: break
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) handleLine(line)
    }
    buffer += decoder.decode()
    if (buffer.trim()) handleLine(buffer)
  } finally {
    try { reader.releaseLock() } catch { /* 已释放 */ }
  }
  return content
}
