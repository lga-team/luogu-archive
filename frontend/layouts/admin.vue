<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  ArrowLeft, BookOpenCheck, Flag, LayoutDashboard, LogOut, Mail, Megaphone, Menu,
  Puzzle, ScrollText, Tags, Trash2, Trophy, UserRound, X,
} from 'lucide-vue-next'

const admin = useAdminStore()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const sidebarOpen = ref(false)

watch(() => route.fullPath, () => { sidebarOpen.value = false })

function logout() {
  admin.clear()
  navigateTo('/admin/login')
}

const groups = computed(() => [
  {
    label: '总览',
    items: [{ to: '/admin', label: '仪表盘', icon: LayoutDashboard }],
  },
  {
    label: '内容',
    items: [
      { to: '/admin/announcements', label: '站点公告', icon: Megaphone },
      { to: '/admin/takedowns', label: '删除申请', icon: Trash2 },
    ],
  },
  {
    label: '数据',
    items: [
      { to: '/admin/accounts', label: '爬取账号', icon: UserRound },
      ...(runtimeConfig.public.extendedArchiveModulesEnabled
        ? [
            { to: '/admin/problems', label: '题库刷新', icon: BookOpenCheck },
            { to: '/admin/contests', label: '比赛归档', icon: Trophy },
          ]
        : []),
    ],
  },
  {
    label: '插件',
    items: [
      { to: '/admin/plugin-applications', label: '插件申请', icon: Puzzle },
      { to: '/admin/plugins', label: '插件管理', icon: Tags },
      { to: '/admin/plugin-tags', label: '插件标签', icon: Tags },
      { to: '/admin/plugin-reports', label: '插件举报', icon: Flag },
    ],
  },
  {
    label: '系统',
    items: [
      { to: '/admin/notification-email', label: '通知邮箱', icon: Mail },
      { to: '/admin/audit', label: '审计日志', icon: ScrollText },
    ],
  },
])

onMounted(() => {
  if (!admin.isLoggedIn && route.path !== '/admin/login') navigateTo('/admin/login')
})
</script>

<template>
  <div v-if="!admin.isLoggedIn" class="admin-guest">
    <slot />
  </div>

  <div v-else class="admin-shell">
    <div v-if="sidebarOpen" class="admin-scrim" @click="sidebarOpen = false" />

    <aside class="admin-side" :class="{ 'is-open': sidebarOpen }">
      <div class="admin-side__brand-row">
        <NuxtLink to="/admin" class="admin-side__brand">
          <img src="/logo.png" alt="" width="28" height="28">
          <span>管理后台</span>
        </NuxtLink>
        <FButton class="only-mobile" appearance="subtle" icon-only aria-label="关闭菜单" @click="sidebarOpen = false">
          <X :size="18" aria-hidden="true" />
        </FButton>
      </div>

      <nav class="admin-side__nav" aria-label="后台导航">
        <template v-for="group in groups" :key="group.label">
          <div class="admin-side__label">{{ group.label }}</div>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="admin-side__link"
            :class="{ 'is-active': item.to === '/admin' ? route.path === '/admin' : route.path === item.to || route.path.startsWith(item.to + '/') }"
          >
            <component :is="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </template>
      </nav>

      <div class="admin-side__bottom">
        <NuxtLink to="/" class="admin-side__link"><ArrowLeft aria-hidden="true" /><span>返回前台</span></NuxtLink>
        <button type="button" class="admin-side__link" @click="logout">
          <LogOut aria-hidden="true" /><span>退出登录</span>
        </button>
      </div>
    </aside>

    <div class="admin-main">
      <div class="admin-topbar">
        <div class="cluster">
          <FButton class="admin-mobile-toggle" appearance="subtle" icon-only aria-label="打开菜单" @click="sidebarOpen = true">
            <Menu :size="19" aria-hidden="true" />
          </FButton>
          <span class="muted" style="font-size: 12px">洛谷档案馆 · 管理后台</span>
        </div>
        <div class="cluster">
          <span class="muted hide-mobile" style="font-size: 12px">{{ admin.displayName || admin.username }}</span>
          <FButton appearance="outline" size="small" @click="navigateTo('/')">前台</FButton>
        </div>
      </div>
      <main class="admin-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-guest { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
.admin-side__brand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.admin-side__brand {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px 14px; font-weight: 600; color: var(--colorNeutralForeground1);
  text-decoration: none; font-size: 15px;
}
.admin-side__brand img { border-radius: 0; background: none; object-fit: contain; }
.admin-side__nav { display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow-y: auto; }
</style>
