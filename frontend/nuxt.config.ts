// 允许环境变量填写源站、/api 或 /api/v1；内部统一归一化为源站，
// 再由 API 客户端拼接 /api/v1。
function normalizeApiBase(value: string | undefined): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '').replace(/\/api(?:\/v1)?$/i, '')
}

const publicApiBase = normalizeApiBase(process.env.NUXT_PUBLIC_API_BASE_URL)
const internalApiBase = normalizeApiBase(process.env.NUXT_API_INTERNAL_URL)
  || `http://127.0.0.1:${process.env.WEB_PORT || '8001'}`
const extendedArchiveModulesEnabled = process.env.NUXT_PUBLIC_EXTENDED_ARCHIVE_MODULES_ENABLED === 'true'
// 本地预览只代理到显式指定的主站；生产构建不启用，避免改变线上部署。
const previewUpstream = process.env.ARCHIVE_PREVIEW_UPSTREAM?.replace(/\/+$/, '')

const hiddenArchiveExactPages = new Set(['/feed', '/fake-realtime'])
const hiddenArchivePagePrefixes = ['/problem', '/contest', '/admin/problems', '/admin/contests']

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: true,
  vite: {
    server: { allowedHosts: true },
    optimizeDeps: {
      include: ['@luogu-saver-next/markdown-renderer', 'dompurify'],
    },
  },
  nitro: {
    devProxy: previewUpstream ? {
      '/api/': { target: previewUpstream + '/api/', changeOrigin: true },
      '/static/img/': { target: previewUpstream + '/static/img/', changeOrigin: true },
    } : {},
  },
  modules: ['@nuxtjs/color-mode', '@pinia/nuxt', '@vueuse/nuxt'],
  runtimeConfig: {
    apiInternalUrl: internalApiBase,
    public: {
      // 浏览器请求的后端源站；留空时使用同源 /api/v1（由反向代理转发）。
      apiBaseUrl: publicApiBase,
      apiPath: '/api/v1',
      extendedArchiveModulesEnabled,
      siteName: '洛谷档案馆',
      captchaProvider: process.env.NUXT_PUBLIC_CAPTCHA_PROVIDER || 'turnstile',
      captchaSiteKey: process.env.NUXT_PUBLIC_CAPTCHA_SITE_KEY || '',
      captchaAliyunPrefix: process.env.NUXT_PUBLIC_CAPTCHA_ALIYUN_PREFIX || '',
      captchaAliyunSceneId: process.env.NUXT_PUBLIC_CAPTCHA_ALIYUN_SCENE_ID || '',
      captchaAliyunRegion: process.env.NUXT_PUBLIC_CAPTCHA_ALIYUN_REGION || 'cn',
      umamiScriptUrl: process.env.NUXT_PUBLIC_UMAMI_SCRIPT_URL || '',
      umamiWebsiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID || '',
    },
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'la-color-mode',
  },
  css: [
    '~/assets/css/fluent-tokens.css',
    'katex/dist/katex.min.css',
    '~/assets/css/app.css',
  ],
  routeRules: {
    '/favicon.png': {
      headers: {
        'cache-control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    },
  },
  hooks: {
    'pages:extend'(pages) {
      if (extendedArchiveModulesEnabled) return

      const removeHiddenPages = (items: typeof pages) => {
        for (let index = items.length - 1; index >= 0; index -= 1) {
          const page = items[index]
          if (
            hiddenArchiveExactPages.has(page.path)
            || hiddenArchivePagePrefixes.some(prefix => (
              page.path === prefix || page.path.startsWith(`${prefix}/`)
            ))
          ) {
            items.splice(index, 1)
            continue
          }
          if (page.children) removeHiddenPages(page.children)
        }
      }

      removeHiddenPages(pages)
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '洛谷档案馆',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f5f5f5', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#1f1f1f', media: '(prefers-color-scheme: dark)' },
        { name: 'robots', content: 'noindex,nofollow,noarchive' },
        { name: 'description', content: '洛谷档案馆 - 第三方存档：文章 / 剪贴板 / 犇犇 / 陶片放逐 / 题解' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/favicon.png' },
      ],
    },
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag.startsWith('fluent-'),
    },
  },
  typescript: {
    strict: true,
  },
  compatibilityDate: '2026-05-01',
})
