/**
 * API 客户端。
 * - 服务端 SSR 使用 apiInternalUrl（默认 http://127.0.0.1:8001）
 * - 浏览器使用 public.apiBaseUrl（默认为空，走同源 /api/v1）
 * - 跨域后端使用 Authorization Bearer，不携带 Cookie（远端 CORS 为 *）
 */
type ApiClient = <T = any>(request: string, options?: any) => Promise<T>

export const useApi = () => {
  const base = useApiBase()
  const credentials = useApiCredentials()

  const client = $fetch.create({
    baseURL: `${base}/api/v1`,
    credentials,
    onRequest({ options }) {
      if (import.meta.client) {
        const auth = useAuthStore()
        if (auth.accessToken) {
          options.headers = {
            ...(options.headers as any),
            Authorization: `Bearer ${auth.accessToken}`,
          }
        }
      }
    },
    onResponseError({ response }) {
      // 未收录内容会返回 404 并触发后台爬取，这是正常业务流程。
      if (response.status === 404) return
      console.warn('[api] error', response.status, response._data)
    },
  })

  return client as unknown as ApiClient
}
