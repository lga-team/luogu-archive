/** 管理后台 API：与用户端共用同一后端源站，使用管理员 token。 */
type AdminApiClient = <T = any>(request: string, options?: any) => Promise<T>

export const useAdminApi = () => {
  const base = useApiBase()
  const credentials = useApiCredentials()

  const client = $fetch.create({
    baseURL: `${base}/api/v1`,
    credentials,
    onRequest({ options }) {
      if (import.meta.client) {
        const admin = useAdminStore()
        if (admin.accessToken) {
          options.headers = {
            ...(options.headers as any),
            Authorization: `Bearer ${admin.accessToken}`,
          }
        }
      }
    },
    onResponseError({ response }) {
      console.warn('[admin api] error', response.status, response._data)
    },
  })

  return client as unknown as AdminApiClient
}
