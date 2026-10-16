<script setup lang="ts">
import {
  BookOpenCheck, ChartNoAxesCombined, FilePenLine, Gavel, House,
  MessageSquareText, MessagesSquare, Puzzle, Settings, Trophy,
} from 'lucide-vue-next'
const runtimeConfig = useRuntimeConfig()
const route = useRoute()

type UmamiProps = Record<string, unknown>
type UmamiTracker = {
  track: (
    payload?: UmamiProps | ((props: UmamiProps) => UmamiProps),
  ) => void
}
type BrowserWindow = Window & { umami?: UmamiTracker }

// 统计只保留页面类别，避免把用户编号、比赛编号等动态 ID 写入分析数据库。
function sanitizeAnalyticsPath(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || '/'
  const segments = pathname.split('/').filter(Boolean)
  const sensitiveRoots = new Set(['user', 'contest', 'paste', 'article', 'discuss'])

  if (segments.length >= 2 && sensitiveRoots.has(segments[0])) {
    return `/${segments[0]}/:id`
  }
  // 插件详情使用文章编号；提交和个人管理是固定页面，不应被合并。
  if (segments.length >= 2 && segments[0] === 'plugin' && !['submit', 'manage'].includes(segments[1])) {
    return '/plugin/:id'
  }
  return pathname
}

function sanitizeAnalyticsLocation(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  try {
    return sanitizeAnalyticsPath(new URL(value, window.location.origin).pathname)
  } catch {
    return sanitizeAnalyticsPath(value)
  }
}

async function waitForUmami(): Promise<UmamiTracker | null> {
  const browserWindow = window as BrowserWindow
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (browserWindow.umami) return browserWindow.umami
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}

async function trackSanitizedPageView() {
  if (!import.meta.client) return
  const tracker = await waitForUmami()
  if (!tracker) return

  tracker.track((props) => ({
    ...props,
    url: sanitizeAnalyticsPath(route.fullPath),
    referrer: sanitizeAnalyticsLocation(props.referrer),
  }))
}

// 只在公共布局加载 Umami；管理后台使用独立布局，不会混入公开站点统计。
useHead(() => {
  const scriptUrl = runtimeConfig.public.umamiScriptUrl
  const websiteId = runtimeConfig.public.umamiWebsiteId
  if (!scriptUrl || !websiteId) return {}

  return {
    script: [
      {
        src: scriptUrl,
        defer: true,
        'data-website-id': websiteId,
        'data-auto-track': 'false',
      },
    ],
  }
})

// Nuxt 是单页应用，首次打开和后续路由切换都要手动补发一次脱敏后的页面访问。
onMounted(() => {
  void trackSanitizedPageView()
})
watch(() => route.fullPath, () => {
  void trackSanitizedPageView()
})

// 运行天数：以 2026-05-01 为元年。客户端 + 服务端都按 UTC 算保证 SSR 一致。
const runDays = computed(() => {
  const start = Date.UTC(2026, 4, 1)
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.max(1, Math.floor((todayUtc - start) / 86400000) + 1)
})

// 左侧导航统一使用 Lucide 组件。
const allNavItems = [
  {
    to: '/',
    label: '首页',
    icon: House,
  },
  {
    to: '/feed',
    label: '伪全网犇',
    extendedArchiveModule: true,
    icon: MessageSquareText,
  },
  {
    to: '/discuss',
    label: '讨论',
    icon: MessagesSquare,
  },
  {
    to: '/judgement',
    label: '陶片放逐',
    icon: Gavel,
  },
  {
    to: '/problem/list',
    label: '题目',
    extendedArchiveModule: true,
    icon: BookOpenCheck,
  },
  {
    to: '/contest',
    label: '比赛',
    extendedArchiveModule: true,
    icon: Trophy,
  },
  {
    to: '/plugin',
    label: '插件',
    icon: Puzzle,
  },
  {
    to: '/solution/fix',
    label: '题解修',
    icon: FilePenLine,
  },
  {
    to: '/site/overview',
    label: '站点概览',
    icon: ChartNoAxesCombined,
  },
]

const navItems = computed(() => allNavItems.filter(
  item => !item.extendedArchiveModule || runtimeConfig.public.extendedArchiveModulesEnabled,
))
</script>

<template>
  <div class="layout-root" :class="{ 'archive-home-layout': route.path === '/', 'archive-modern': ['/', '/announcement', '/settings', '/login', '/judgement', '/discuss'].includes(route.path) }">
    <div class="archive-theme-backdrop" aria-hidden="true" />
    <aside class="side-nav">
      <div class="side-top">
      <NuxtLink to="/" class="brand" title="洛谷档案馆">
        <img src="/favicon.png" alt="洛谷档案馆" class="brand-logo">
        <span class="brand-logo-mono" aria-hidden="true" />
        <span class="label">洛谷档案馆</span>
      </NuxtLink>

      <nav class="nav-items">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :title="item.label"
        >
          <component :is="item.icon" class="icon" :size="22" :stroke-width="2" aria-hidden="true" />
          <span class="label">{{ item.label }}</span>
        </NuxtLink>
      </nav>
      </div>

      <div class="side-bottom">
        <NuxtLink to="/settings" class="nav-item" title="设置" aria-label="设置">
          <Settings class="icon" :size="22" :stroke-width="2" aria-hidden="true" />
          <span class="label">设置</span>
        </NuxtLink>
      </div>
    </aside>

    <div class="layout-body">
      <main class="container main-area">
        <slot />
      </main>

      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-main">
            <div class="footer-brand-row">
              <div class="footer-brand">洛谷档案馆</div>
              <div class="footer-days">已运行 {{ runDays }} 天</div>
            </div>
            <div class="footer-note">
              第三方存档，与洛谷官方无关。本站仅做公开内容归档与历史版本追踪，所有内容版权归原作者。
            </div>
          </div>
          <div class="footer-links">
            <div class="footer-link-title">站点相关</div>
            <div class="footer-link-list">
              <a href="https://github.com/px-poxiao/luogu-archive" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://qm.qq.com/q/b4D2ZhhtN6" target="_blank" rel="noopener noreferrer">
                QQ群（936024195）
              </a>
              <NuxtLink to="/takedown">侵权投诉 / 内容删除</NuxtLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.layout-root {
  min-height: 100vh;
}

/* 左侧悬停展开导航栏 */
.side-nav {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 56px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  gap: 4px;
  z-index: 20;
  overflow: hidden;
  transition: width 0.18s ease;
}
.side-nav:hover {
  width: 200px;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.06);
}

.brand,
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  color: var(--text);
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
  white-space: nowrap;
  transition: background 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
}
.brand { font-weight: 700; font-size: 15px; margin-bottom: 6px; }
.nav-item:hover,
.brand:hover {
  background: var(--hover);
  text-decoration: none;
}
.nav-item.router-link-active {
  background: var(--hover);
  color: var(--link);
}

.icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: inherit;
}

.brand-logo {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 7px;
  object-fit: cover;
  display: block;
  margin-left: -4px;
}

.label {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s ease, transform 0.18s ease;
  pointer-events: none;
}
.side-nav:hover .label {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.side-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
}

/* 主体 */
.layout-body {
  /* 侧边栏是 content-box：56px 宽 + 左右 8px padding + 1px 边框，总占位 73px。 */
  margin-left: 73px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 0;
}
.main-area {
  flex: 1;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--page-max-width));
  max-width: none;
  padding: 28px 0 56px;
  box-sizing: border-box;
}
.site-footer {
  box-sizing: border-box;
  min-height: 156px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 28px 0 32px;
  font-size: 14px;
  color: var(--text-muted);
  flex-shrink: 0;
  /* 横跨整个 viewport（拉出 layout-body 的侧栏偏移），
     左侧区域被 fixed 边栏盖在上面 —— 视觉上 footer 下"穿过"边栏，
     左右各 53px padding 对称（≈ 2 倍行高）。 */
  margin-left: -73px;
}
.side-top {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  min-width: 0;
}
.footer-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: start;
  /* 左 padding = 侧边栏真实占位 73px + 53px；右 53px。 */
  padding: 0 53px 0 126px;
  gap: 42px;
}
.footer-main {
  min-width: 0;
}
.footer-brand-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.footer-brand {
  color: var(--text);
  font-weight: 700;
  font-size: 18px;
  white-space: nowrap;
}
.footer-days {
  color: var(--text-muted);
  font-size: 13px;
}
.footer-note {
  max-width: 760px;
  line-height: 1.85;
}
.footer-links {
  justify-self: end;
  min-width: 220px;
}
.footer-link-title {
  color: var(--text);
  font-weight: 700;
  margin-bottom: 8px;
}
.footer-link-list {
  display: grid;
  gap: 7px;
  justify-items: start;
}
.footer-link-list a {
  color: var(--text-muted);
}
.footer-link-list a:hover {
  color: var(--link);
}

/* The homepage fits above its fixed footer; settings stay at the sidebar bottom. */
.archive-home-layout { --footer-height: 180px; height: 100dvh; min-height: 0; overflow: hidden; }
.archive-home-layout .site-footer { height: var(--footer-height); min-height: 0; }
.archive-home-layout .layout-body {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) var(--footer-height);
}
.archive-home-layout .main-area { min-height: 0; padding: 16px 0; display: flex; }
.archive-home-layout .nav-items { min-height: 0; }
.archive-home-layout .nav-items .nav-item { min-height: 0; }
@media (max-height: 640px) {
  .archive-home-layout .nav-item { padding: 6px 10px; }
  .archive-home-layout .brand { padding-top: 6px; padding-bottom: 6px; }
  .archive-home-layout .brand-logo { width: 28px; height: 28px; }
}

@media (max-width: 768px) {
  .archive-home-layout { --footer-height: 300px; }
  .site-footer {
    padding: 24px 0 28px;
  }
  .footer-inner {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 0 18px 0 91px;
  }
  .footer-links {
    justify-self: start;
  }
}

/* 左侧栏在所有设备（含手机端）保持一致，固定贴左。 */
</style>

