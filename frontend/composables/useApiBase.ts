/**
 * 后端源站解析。
 * 支持 NUXT_PUBLIC_API_BASE_URL 填写 https://host、https://host/api 或 https://host/api/v1，
 * 内部统一归一化为源站，再拼接 /api/v1。
 */
export function normalizeApiBase(value: string | undefined | null): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '').replace(/\/api(?:\/v1)?$/i, '')
}

export function useApiBase(): string {
  const config = useRuntimeConfig()
  const base = import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl
  return normalizeApiBase(base)
}

/** 浏览器端跨域时不能带 Cookie（远端 CORS 使用 *）。 */
export function useApiCredentials(): RequestCredentials {
  if (import.meta.server) return 'omit'
  const base = useApiBase()
  if (!base) return 'include'
  try {
    return new URL(base, window.location.href).origin === window.location.origin ? 'include' : 'omit'
  } catch {
    return 'omit'
  }
}

/** 构造后端静态资源 / 非 /api/v1 路径的绝对地址。 */
export function useApiAsset(path: string): string {
  const base = useApiBase()
  const normalized = path.startsWith('/') ? path : '/' + path
  return base ? base + normalized : normalized
}
