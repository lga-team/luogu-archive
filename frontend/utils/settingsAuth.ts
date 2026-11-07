export function safeAuthReturn(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u0020\u007f]/.test(value)) return
  const origin = 'https://archive.invalid'
  try {
    const url = new URL(value, origin)
    if (url.origin !== origin || value.startsWith('//') || /^\/[\\/]/.test(decodeURIComponent(url.pathname))) return
    return url.pathname + url.search + url.hash
  } catch { return }
}

export function settingsAuthRoute(mode: 'login' | 'register', redirect?: unknown) {
  const path = safeAuthReturn(redirect)
  return { path: '/settings', query: path ? { mode, redirect: path } : { mode } }
}
