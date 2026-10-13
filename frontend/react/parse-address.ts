const sourceHosts = new Set([
  'luogu.com.cn', 'www.luogu.com.cn', 'luogu.com', 'www.luogu.com',
  'luogu.org', 'www.luogu.org', 'luogu.ac.cn', 'www.luogu.ac.cn',
])

// 只接受明确的洛谷对象链接，禁止把输入当作任意外部跳转地址。
export function parseArchiveAddress(input: string, extended = false): string {
  const value = input.trim()
  if (!value) throw new Error('请输入洛谷链接。')
  let url: URL
  try { url = new URL(value.includes('://') ? value : `https://${value}`) }
  catch { throw new Error('链接格式不正确，请粘贴完整的洛谷链接。') }
  if (!['http:', 'https:'].includes(url.protocol) || !sourceHosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) {
    throw new Error('请输入洛谷主站或档案馆的链接。')
  }
  const path = url.pathname.replace(/\/$/, '')
  if (/^\/(article|paste)\/[a-zA-Z0-9]+$/.test(path) || /^\/(user|discuss)\/[1-9]\d*$/.test(path)) return path
  if (path === '/judgement') return path
  if (/^\/feed\/[1-9]\d*$/.test(path)) return path
  if (/^\/contest\/[1-9]\d*$/.test(path) || /^\/problem\/[A-Za-z0-9_-]+$/.test(path)) {
    if (!extended) throw new Error('本站目前未开放比赛和题目归档页面。')
    // 本站没有单题详情路由，不把主站题目地址误跳到不存在的页面。
    if (path.startsWith('/problem/')) throw new Error('本站暂不支持直接打开单题归档。')
    return path
  }
  throw new Error('暂不支持这个地址，请输入用户主页、文章、剪贴板、讨论或犇犇链接。')
}
