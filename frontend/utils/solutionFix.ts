export function parseSolutionArticleId(input: string): string {
  let value = input.trim()
  if (/^[A-Za-z0-9_-]{1,64}$/.test(value)) return value
  if (/^(?:www\.)?luogu\./i.test(value)) value = `https://${value}`
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    const hosts = ['www.luogu.com.cn', 'luogu.com.cn', 'www.luogu.com', 'luogu.com', 'www.luogu.ac.cn', 'luogu.ac.cn']
    if (!hosts.includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) throw new Error('只支持洛谷或档案馆的文章链接。')
    value = url.pathname
  }
  const match = value.match(/^\/(?:article|atricle)\/([A-Za-z0-9_-]{1,64})\/?$/i)
  if (!match) throw new Error('请输入文章链接、/article/文章编号或纯文章编号。')
  return match[1]!
}

export interface SolutionStreamCallbacks {
  model: (value: string) => void
  thought: (value: string) => void
  content: (value: string) => void
}

export async function readSolutionFixStream(response: Response, callbacks: SolutionStreamCallbacks): Promise<string> {
  if (!response.ok || !response.body) {
    let message = `AI 修正失败（${response.status}）`
    try {
      const data = await response.json()
      if (typeof data?.message === 'string') message = data.message
    } catch { /* 非 JSON 错误保留 HTTP 状态。 */ }
    throw new Error(message)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false
  let receivedContent = false
  const parts: string[] = []
  function consume(line: string) {
    if (!line.trim() || completed) return
    const event = JSON.parse(line)
    if (event.event === 'meta' && typeof event.data?.model === 'string') callbacks.model(event.data.model)
    else if (event.event === 'thought' && typeof event.data === 'string') callbacks.thought(event.data)
    else if (event.event === 'content' && typeof event.data === 'string') {
      receivedContent = true
      parts.push(event.data)
      callbacks.content(event.data)
    } else if (event.event === 'done') completed = true
    else if (event.event === 'error') throw new Error(typeof event.data === 'string' ? event.data : 'AI 修正失败')
  }
  try {
    while (!completed) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) consume(line)
      if (done) { consume(buffer); break }
    }
    if (!completed) throw new Error('连接提前结束，未收到完整修正结果，请重试。')
    if (!receivedContent) throw new Error('AI 未返回修正内容，请重试。')
    return parts.join('')
  } finally {
    try { await reader.cancel() } catch { /* 连接中断时保留原始错误。 */ }
    reader.releaseLock()
  }
}
