<script setup lang="ts">
import { computed, markRaw, onMounted, ref, watch } from 'vue'
import { MoreHorizontal, Settings } from 'lucide-vue-next'

const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const { groups, bottomItems, isActive } = useNavigation()
useDisplayMode()

const hovered = ref(false)
const drawerOpen = ref(false)
const expanded = computed(() => hovered.value)
const collapsed = computed(() => !expanded.value)

const settingsItem = { to: '/settings', label: '设置', icon: markRaw(Settings) }
const menuItems = computed(() => {
  const list = groups.value.flatMap(group => group.items)
  if (!list.some(item => item.to === '/settings')) list.push(settingsItem)
  return list
})

function onRailEnter() {
  if (window.matchMedia('(min-width: 901px)').matches) hovered.value = true
}
function onRailLeave() {
  hovered.value = false
}
function onRailFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement)?.contains(next)) hovered.value = false
}
watch(() => route.fullPath, () => { drawerOpen.value = false })
onMounted(() => { drawerOpen.value = false })

type UmamiProps = Record<string, unknown>
type UmamiTracker = { track: (payload?: UmamiProps | ((props: UmamiProps) => UmamiProps)) => void }
type BrowserWindow = Window & { umami?: UmamiTracker }

function sanitizeAnalyticsPath(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || '/'
  const segments = pathname.split('/').filter(Boolean)
  const sensitiveRoots = new Set(['user', 'contest', 'paste', 'article', 'discuss'])
  if (segments.length >= 2 && sensitiveRoots.has(segments[0])) return `/${segments[0]}/:id`
  if (segments.length >= 2 && segments[0] === 'plugin' && !['submit', 'manage'].includes(segments[1])) return '/plugin/:id'
  return pathname
}

function sanitizeAnalyticsLocation(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  try { return sanitizeAnalyticsPath(new URL(value, window.location.origin).pathname) }
  catch { return sanitizeAnalyticsPath(value) }
}

async function waitForUmami(): Promise<UmamiTracker | null> {
  const browserWindow = window as BrowserWindow
  for (let attempt = 0; attempt < 40; attempt += 1) {
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

useHead(() => {
  const scriptUrl = runtimeConfig.public.umamiScriptUrl
  const websiteId = runtimeConfig.public.umamiWebsiteId
  if (!scriptUrl || !websiteId) return {}
  return {
    script: [{ src: scriptUrl, defer: true, 'data-website-id': websiteId, 'data-auto-track': 'false' }],
  }
})

onMounted(() => { void trackSanitizedPageView() })
watch(() => route.fullPath, () => { void trackSanitizedPageView() })

const runDays = computed(() => {
  const start = Date.UTC(2026, 4, 1)
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.max(1, Math.floor((todayUtc - start) / 86400000) + 1)
})

useHead({ bodyAttrs: { class: 'app-body' } })

</script>

<template>
  <div class="app-shell">
    <a href="#main-content" class="skip-link">跳到主要内容</a>

    <aside
      class="app-rail"
      :class="{ 'is-expanded': expanded }"
      aria-label="主导航"
      @mouseenter="onRailEnter"
      @mouseleave="onRailLeave"
      @focusin="hovered = true"
      @focusout="onRailFocusOut"
    >
      <NuxtLink to="/" class="rail-brand" aria-label="洛谷档案馆首页">
        <img src="/logo.png" alt="" width="32" height="32">
        <span class="rail-brand__name">洛谷档案馆</span>
      </NuxtLink>

      <nav class="rail-nav">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="rail-item"
          :class="{ 'is-active': isActive(route.path, item.to) }"
          :title="collapsed ? item.label : undefined"
          :aria-label="item.label"
        >
          <component :is="item.icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
          <span class="rail-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <main id="main-content" class="app-main">
      <slot />
    </main>

    <footer v-if="route.path !== '/'" class="app-footer">
      <div class="app-footer__inner">
        <div>
          <div class="app-footer__brand">
            <span class="app-footer__name">洛谷档案馆</span>
            <span class="app-footer__days">已运行 {{ runDays }} 天</span>
          </div>
          <p class="app-footer__note">
            第三方存档，与洛谷官方无关。本站仅做公开内容归档与历史版本追踪，所有内容版权归原作者。
          </p>
        </div>
        <div class="app-footer__links">
          <span class="app-footer__links-title">站点相关</span>
          <a href="https://github.com/px-poxiao/luogu-archive" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>
          <a href="https://qm.qq.com/q/b4D2ZhhtN6" target="_blank" rel="noopener noreferrer">QQ 群（936024195）</a>
          <NuxtLink to="/announcement">站点公告</NuxtLink>
          <NuxtLink to="/takedown">侵权投诉 / 内容删除</NuxtLink>
        </div>
      </div>
    </footer>

    <nav class="bottom-nav" aria-label="移动端导航">
      <div class="bottom-nav__inner">
        <NuxtLink
          v-for="item in bottomItems"
          :key="item.to"
          :to="item.to"
          class="bottom-nav__item"
          :class="{ 'is-active': isActive(route.path, item.to) }"
        >
          <component :is="item.icon" aria-hidden="true" />
          <span>{{ item.label === '陶片放逐' ? '陶片' : item.label }}</span>
        </NuxtLink>
        <button type="button" class="bottom-nav__item" :class="{ 'is-active': drawerOpen }" @click="drawerOpen = true">
          <MoreHorizontal aria-hidden="true" />
          <span>更多</span>
        </button>
      </div>
    </nav>

    <MobileMoreSheet v-model:open="drawerOpen" :items="menuItems" />

  </div>
</template>

<style scoped>
.skip-link {
  position: absolute; left: -9999px; top: 8px; z-index: 1300;
  padding: 8px 14px; border-radius: 6px;
  background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);
  box-shadow: var(--shadow8);
}
.skip-link:focus { left: 80px; }

.app-rail {
  position: fixed; inset: 0 auto 0 0; z-index: 1000;
  width: 64px;
  display: flex; flex-direction: column;
  background: var(--colorNeutralBackground1);
  background: color-mix(in srgb, var(--colorNeutralBackground1) 82%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(1.35);
  backdrop-filter: blur(18px) saturate(1.35);
  border-right: 1px solid var(--colorNeutralStroke2);
  box-shadow: var(--shadow2);
  overflow: hidden;
  will-change: width;
  transition: width 300ms cubic-bezier(.4, 0, .2, 1);
}
.app-rail.is-expanded { width: 240px; }
.rail-brand {
  position: relative;
  display: flex; align-items: center;
  height: 72px; flex: 0 0 72px;
  padding: 0 16px;
  border-bottom: 1px solid var(--colorNeutralStroke2);
  color: var(--colorNeutralForeground1);
  text-decoration: none;
  overflow: hidden;
  white-space: nowrap;
}
.rail-brand:hover { text-decoration: none; }
.rail-brand img { width: 32px; height: 32px; flex: 0 0 32px; object-fit: contain; background: none; border-radius: 0; box-shadow: none; }
.rail-brand__name {
  position: absolute; left: 60px; top: 50%;
  transform: translateY(-50%) translateX(-6px);
  font-size: 16px; font-weight: 700; letter-spacing: .01em;
  white-space: nowrap;
  opacity: 0; pointer-events: none;
  transition: opacity 160ms cubic-bezier(.4, 0, .2, 1), transform 200ms cubic-bezier(.4, 0, .2, 1);
}
.is-expanded .rail-brand__name { opacity: 1; transform: translateY(-50%) translateX(0); transition-delay: 40ms; }

.rail-nav {
  display: flex; flex-direction: column; gap: 4px;
  padding: 10px 8px;
  flex: 1 1 auto;
  overflow-y: auto; overflow-x: hidden;
  scrollbar-width: none;
}
.rail-nav::-webkit-scrollbar { display: none; }
.rail-item {
  position: relative;
  display: flex; align-items: center; justify-content: flex-start;
  width: 100%; height: 48px;
  margin: 0;
  padding: 0 0 0 13px;
  gap: 0;
  border-radius: 6px;
  color: var(--colorNeutralForeground2);
  font-size: 14px; font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  flex: 0 0 48px;
  transition: background-color 120ms ease, color 120ms ease;
}
.rail-item:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorNeutralForeground1); text-decoration: none; }
.rail-item.is-active { background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-weight: 600; }
.rail-item.is-active::before {
  content: ''; position: absolute; left: 0; top: 10px; bottom: 10px;
  width: 3px; border-radius: 0 2px 2px 0;
  background: var(--colorBrandBackground);
}
.rail-item :deep(svg) { flex-shrink: 0; }
.rail-label {
  position: absolute; left: 47px; top: 50%;
  transform: translateY(-50%) translateX(-6px);
  opacity: 0; width: auto;
  white-space: nowrap; pointer-events: none; overflow: hidden;
  transition: opacity 180ms ease, transform 300ms cubic-bezier(.4, 0, .2, 1);
}
.is-expanded .rail-label { opacity: 1; transform: translateY(-50%) translateX(0); transition-delay: 50ms; }


@media (max-width: 900px) {
  .app-rail { display: none; }
}
</style>
