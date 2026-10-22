<script setup lang="ts">
import {
  BarChart3,
  BookOpen,
  Gavel,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessagesSquare,
  PanelLeft,
  Puzzle,
  Trophy,
  User,
  Wrench,
} from '@lucide/vue'
import { Toaster } from '~/components/ui/sonner'

const auth = useAuthStore()
const api = useApi()
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

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }) } catch {}
  auth.clear()
  navigateTo('/')
}

// 运行天数：以 2026-05-01 为元年。客户端 + 服务端都按 UTC 算保证 SSR 一致。
const runDays = computed(() => {
  const start = Date.UTC(2026, 4, 1)
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.max(1, Math.floor((todayUtc - start) / 86400000) + 1)
})

// 左侧导航项
const allNavItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/feed', label: '伪全网犇', icon: MessagesSquare, extendedArchiveModule: true },
  { to: '/discuss', label: '讨论', icon: MessagesSquare },
  { to: '/judgement', label: '陶片放逐', icon: Gavel },
  { to: '/problem/list', label: '题目', icon: BookOpen, extendedArchiveModule: true },
  { to: '/contest', label: '比赛', icon: Trophy, extendedArchiveModule: true },
  { to: '/plugin', label: '插件', icon: Puzzle },
  { to: '/solution/fix', label: '题解修', icon: Wrench },
  { to: '/site/overview', label: '站点概览', icon: BarChart3 },
]

const navItems = computed(() => allNavItems.filter(
  item => !item.extendedArchiveModule || runtimeConfig.public.extendedArchiveModulesEnabled,
))

// 折叠状态写进 cookie，SSR 与客户端读到同一个值，避免刷新时侧栏跳动。
const collapsed = useCookie<boolean>('la_sidebar_collapsed', {
  default: () => false,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
})
const mobileOpen = ref(false)

// 用显式判断替代 active-class：active-class 会和基础 text-muted-foreground
// 同时命中，最终颜色取决于生成 CSS 的顺序，结果不可控。
function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

const rowBase = 'flex items-center rounded-md px-[11px] py-2 text-sm transition-[gap,color,background-color] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)]'

function navClass(to: string, collapsedMode = false) {
  return [
    rowBase,
    collapsedMode ? 'gap-0' : 'gap-3',
    isActive(to)
      ? 'bg-accent font-medium text-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  ]
}

function rowClass(collapsedMode = false, interactive = true) {
  return [
    rowBase,
    collapsedMode ? 'gap-0' : 'gap-3',
    interactive
      ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
      : 'text-muted-foreground',
  ]
}

// 折叠时文字用 max-width + opacity 收起，而不是 v-if：宽度动画进行到一半时
// 文字仍占着容器宽度，会换行、把行高撑开。
function labelClass(collapsedMode = false) {
  return [
    'overflow-hidden text-ellipsis whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)]',
    collapsedMode ? 'max-w-0 opacity-0' : 'max-w-[176px] opacity-100',
  ]
}

watch(() => route.fullPath, () => { mobileOpen.value = false })
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <!-- 移动端顶栏：fixed 而非 sticky，弹层锁滚动给 body 加 overflow:hidden 时 sticky 会失去参照 -->
    <header class="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md lg:hidden">
      <Sheet v-model:open="mobileOpen">
        <SheetTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="打开导航">
            <Menu class="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" class="flex w-72 flex-col gap-1 p-3">
          <SheetTitle class="sr-only">站点导航</SheetTitle>
          <NuxtLink to="/" class="mb-2 flex items-center gap-3 px-2 py-1.5">
            <img src="/favicon.png" alt="" class="size-8 rounded-md">
            <span class="text-sm font-semibold">洛谷档案馆</span>
          </NuxtLink>
          <nav class="flex flex-col gap-0.5">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :class="navClass(item.to)"
            >
              <component :is="item.icon" class="size-[18px] shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <Separator class="my-2" />
          <NuxtLink
            v-if="auth.isLoggedIn"
            to="/me"
            class="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <User class="size-[18px]" />
            <span class="truncate">{{ auth.displayName || '我的关注' }}</span>
          </NuxtLink>
          <NuxtLink
            v-else-if="auth.initialized"
            to="/login"
            class="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogIn class="size-[18px]" />
            <span>登录</span>
          </NuxtLink>
        </SheetContent>
      </Sheet>

      <NuxtLink to="/" class="flex items-center gap-2">
        <img src="/favicon.png" alt="" class="size-7 rounded-md">
        <span class="text-sm font-semibold">洛谷档案馆</span>
      </NuxtLink>

      <div class="ml-auto">
        <ThemeToggle />
      </div>
    </header>

    <!-- 桌面侧栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-border bg-card transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)] lg:flex"
      :class="collapsed ? 'w-14' : 'w-60'"
    >
      <div class="flex h-14 items-center overflow-hidden px-3">
        <NuxtLink to="/" class="flex min-w-0 items-center transition-[gap] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)]" :class="collapsed ? 'gap-0' : 'gap-3'">
          <img src="/favicon.png" alt="" class="size-8 max-w-none shrink-0 rounded-md">
          <span class="text-sm font-semibold" :class="labelClass(collapsed)">洛谷档案馆</span>
        </NuxtLink>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 py-2">
        <TooltipProvider :delay-duration="200">
          <Tooltip v-for="item in navItems" :key="item.to" :disabled="!collapsed">
            <TooltipTrigger as-child>
              <NuxtLink
                :to="item.to"
                :class="navClass(item.to, collapsed)"
              >
                <component :is="item.icon" class="size-[18px] shrink-0" />
                <span :class="labelClass(collapsed)">{{ item.label }}</span>
              </NuxtLink>
            </TooltipTrigger>
            <TooltipContent side="right">{{ item.label }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </nav>

      <div class="flex flex-col gap-0.5 overflow-x-hidden border-t border-border p-2">
        <template v-if="auth.isLoggedIn">
          <NuxtLink
            to="/me"
            :class="rowClass(collapsed)"
          >
            <User class="size-[18px] shrink-0" />
            <span :class="labelClass(collapsed)">{{ auth.displayName || '我的关注' }}</span>
          </NuxtLink>
          <button
            type="button"
            :class="rowClass(collapsed)"
            @click="logout"
          >
            <LogOut class="size-[18px] shrink-0" />
            <span :class="labelClass(collapsed)">登出</span>
          </button>
        </template>
        <template v-else-if="auth.initialized">
          <NuxtLink
            to="/login"
            :class="rowClass(collapsed)"
          >
            <LogIn class="size-[18px] shrink-0" />
            <span :class="labelClass(collapsed)">登录</span>
          </NuxtLink>
        </template>
        <div
          v-else
          :class="rowClass(collapsed, false)"
        >
          <span class="size-[18px] shrink-0 animate-pulse rounded-full bg-muted" />
          <span :class="labelClass(collapsed)">登录状态</span>
        </div>

        <ThemeToggle variant="nav" :collapsed="collapsed" />

        <button
          type="button"
          :class="rowClass(collapsed)"
          :aria-label="collapsed ? '展开侧栏' : '折叠侧栏'"
          @click="collapsed = !collapsed"
        >
          <PanelLeft class="size-[18px] shrink-0" />
          <span :class="labelClass(collapsed)">折叠侧栏</span>
        </button>
      </div>
    </aside>

    <div class="flex min-h-dvh flex-col pt-14 transition-[padding] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)] lg:pt-0" :class="collapsed ? 'lg:pl-14' : 'lg:pl-60'">
      <main class="mx-auto w-full max-w-[1180px] flex-1 px-[var(--page-gutter)] py-8">
        <slot />
      </main>

      <footer class="border-t border-border bg-card">
        <div class="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-[var(--page-gutter)] py-8 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-baseline gap-3">
              <span class="text-base font-semibold text-foreground">洛谷档案馆</span>
              <span class="text-xs text-muted-foreground">已运行 {{ runDays }} 天</span>
            </div>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              第三方存档，与洛谷官方无关。本站仅做公开内容归档与历史版本追踪，所有内容版权归原作者。
            </p>
          </div>
          <div class="shrink-0 sm:text-right">
            <p class="mb-2 text-sm font-medium text-foreground">站点相关</p>
            <div class="flex flex-col gap-1.5 text-sm text-muted-foreground sm:items-end">
              <a href="https://github.com/px-poxiao/luogu-archive" target="_blank" rel="noopener noreferrer" class="text-muted-foreground transition-colors hover:text-foreground">GitHub</a>
              <a href="https://qm.qq.com/q/b4D2ZhhtN6" target="_blank" rel="noopener noreferrer" class="text-muted-foreground transition-colors hover:text-foreground">QQ群（936024195）</a>
              <NuxtLink to="/takedown" class="text-muted-foreground transition-colors hover:text-foreground">侵权投诉 / 内容删除</NuxtLink>
            </div>
          </div>
        </div>
      </footer>
    </div>

    <Toaster position="top-center" :duration="3200" />
  </div>
</template>
