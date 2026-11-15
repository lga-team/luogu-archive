/**
 * 同源用户脚本安装代理。
 *
 * 脚本管理器（Tampermonkey / Violentmonkey 等）只会在三个条件同时成立时接管安装：
 *   1. 响应 MIME 是 JavaScript（text/javascript）；
 *   2. 没有 Content-Disposition: attachment；
 *   3. URL 路径以 .user.js 结尾。
 * 后端下载接口本身要么带 attachment，要么跨域（且远端尚未部署 inline 路由），
 * 所以这里由本站 Nitro 做一次流式转发：取后端原始字节，重写响应头后按 JS 返回。
 * 这样即使后端还是旧的 text/plain + attachment 行为，也能被接管。
 */
export default defineEventHandler(async (event) => {
  const method = event.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const articleId = decodeURIComponent(getRouterParam(event, 'articleId') || '')
  const versionId = getRouterParam(event, 'versionId') || ''
  const filename = decodeURIComponent(getRouterParam(event, 'filename') || '')
  if (!articleId || !/^\d+$/.test(versionId) || !filename.toLowerCase().endsWith('.user.js')) {
    throw createError({ statusCode: 404, statusMessage: '安装文件不存在' })
  }

  const config = useRuntimeConfig(event)
  const base = String(config.apiInternalUrl || '').replace(/\/+$/, '')
  if (!base) throw createError({ statusCode: 502, statusMessage: '后端地址未配置' })

  const target = `${base}/api/v1/plugins/${encodeURIComponent(articleId)}/download/${versionId}`

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method,
      headers: { accept: 'text/javascript, text/plain;q=0.9, */*;q=0.8' },
      redirect: 'follow',
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: '无法连接后端下载服务' })
  }

  if (!upstream.ok) {
    setResponseStatus(event, upstream.status)
    return { message: '安装文件暂不可用', status: upstream.status }
  }

  // 关键三步：JS MIME、无 attachment、URL 已由路由保证以 .user.js 结尾。
  setHeader(event, 'content-type', 'text/javascript; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store')
  setHeader(event, 'x-content-type-options', 'nosniff')

  if (method === 'HEAD' || !upstream.body) return ''

  setResponseStatus(event, 200)
  return sendStream(event, upstream.body as ReadableStream)
})
