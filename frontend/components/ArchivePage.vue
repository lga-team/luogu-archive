<script setup lang="ts">
import {
  ArrowRight, BookOpenCheck, ChartNoAxesCombined, ChevronLeft, ChevronRight, Clipboard, FilePenLine, FileText, Gavel,
  Megaphone, MessagesSquare, Puzzle, RefreshCw, Search, Trophy, MessageSquareText,
} from 'lucide-vue-next'
import { parseArchiveAddress } from '~/utils/parseArchiveAddress'

interface Announcement { id: number; title: string; summary: string; content: string; published_at: string }

const props = defineProps<{ page: 'home' | 'announcement' }>()
const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()
const input = ref('')
const error = ref('')
const read = ref<string[]>([])
const { data: announcementData, pending: loading, error: announcementError, refresh: refreshAnnouncements } = useAsyncData(
  `announcements-${props.page}`,
  () => api<Announcement[]>('/site/announcements', { query: { limit: props.page === 'home' ? 10 : 50 } }),
  { server: true },
)
const announcements = computed(() => announcementData.value || [])
const failed = computed(() => Boolean(announcementError.value))
const announcementContent = ref<HTMLElement | null>(null)
useCopyCode(announcementContent)

const { data: overview, status: overviewStatus } = useLazyAsyncData<any>('home-overview', () =>
  props.page === 'home'
    ? api('/site/overview', { timeout: 8000, retry: 0 }).catch(() => null)
    : Promise.resolve(null),
  { server: false },
)
const announcementIndex = ref(0)
const activeAnnouncement = computed(() => announcements.value[announcementIndex.value] || null)
function prevAnnouncement() {
  announcementIndex.value = Math.max(0, announcementIndex.value - 1)
}
function nextAnnouncement() {
  announcementIndex.value = Math.min(announcements.value.length - 1, announcementIndex.value + 1)
}
watch(announcements, list => {
  if (announcementIndex.value >= list.length) announcementIndex.value = 0
})
const statCards = computed(() => {
  const totals = overview.value?.totals || {}
  const cards = [
    { label: '文章总数', value: totals.articles, icon: FileText },
    { label: '剪贴板总数', value: totals.pastes, icon: Clipboard },
  ]
  if (extended.value) {
    cards.push(
      { label: '犇犇总数', value: totals.feeds, icon: MessageSquareText },
      { label: '陶片记录', value: totals.judgements, icon: Gavel },
    )
  }
  return cards
})

const readKey = 'archive-read-announcements-v1'

const selectedId = computed(() => Number(route.query.id) || null)
const selected = computed(() => announcements.value.find(item => item.id === selectedId.value))
const extended = computed(() => Boolean(config.public.extendedArchiveModulesEnabled))
const quickLinks = computed(() => {
  const links = [
    { to: '/discuss', label: '讨论', desc: '洛谷讨论区的最新与历史版本', icon: MessagesSquare },
    { to: '/judgement', label: '陶片放逐', desc: '公开的用户封禁与处罚记录', icon: Gavel },
    { to: '/plugin', label: '插件市场', desc: '归档、检索与安装社区插件', icon: Puzzle },
    { to: '/solution/fix', label: '题解修复', desc: '整理题解、生成可读正文', icon: FilePenLine },
    { to: '/site/overview', label: '站点概览', desc: '档案馆的数据与运行状态', icon: ChartNoAxesCombined },
  ]
  if (extended.value) {
    links.unshift(
      { to: '/feed', label: '伪全网犇', desc: '全站犇犇时间线存档', icon: MessageSquareText },
      { to: '/problem/list', label: '题目库', desc: '按难度浏览归档题目', icon: BookOpenCheck },
      { to: '/contest', label: '比赛', desc: '比赛信息与成绩归档', icon: Trophy },
    )
  }
  return links
})

const formatCount = (value?: number | null) => value == null ? '—' : value.toLocaleString('zh-CN')

const runDays = computed(() => {
  const start = Date.UTC(2026, 4, 1)
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(1, Math.floor((today - start) / 86400000) + 1)
})

function announcementKey(item: Announcement) { return item.id + ':' + item.published_at }

function readAnnouncements(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(readKey) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, dateStyle: 'medium', timeStyle: 'short' })
}

function openAddress() {
  try {
    error.value = ''
    const raw = input.value.trim()
    // 支持直接输入洛谷文章 ID（字母数字混合），其余交给链接解析。
    if (/^[A-Za-z0-9]{6,16}$/.test(raw) && /[A-Za-z]/.test(raw)) {
      void navigateTo('/article/' + raw)
      return
    }
    void navigateTo(parseArchiveAddress(raw, Boolean(config.public.extendedArchiveModulesEnabled)))
  } catch (reason) {
    error.value = (reason as Error).message
  }
}

function loadAnnouncements() { return refreshAnnouncements() }

watch(selected, item => {
  if (!item || import.meta.server) return
  const next = Array.from(new Set([...readAnnouncements(), announcementKey(item)])).slice(-200)
  try { localStorage.setItem(readKey, JSON.stringify(next)) } catch { /* 存储不可用时忽略 */ }
  read.value = next
})

onMounted(() => {
  read.value = readAnnouncements()
})
</script>

<template>
  <div v-if="page === 'home'" class="home-page">
    <header class="home-brand">
      <div class="home-brand__main">
        <img src="/logo.png" alt="" width="60" height="60" class="home-brand__logo">
        <h1 class="home-brand__title">洛谷档案馆</h1>
      </div>
      <p class="home-brand__subtitle">Archive Everything</p>
    </header>

    <form class="home-pill" role="search" @submit.prevent="openAddress">
      <Search class="home-pill__icon" :size="20" aria-hidden="true" />
      <FInput
        v-model="input"
        class="home-pill__input"
        aria-label="洛谷地址或文章 ID"
        placeholder="输入洛谷链接或文章 ID"
        autocomplete="off"
        @update:model-value="error = ''"
        @enter="openAddress"
      />
      <FButton
        class="home-pill__submit"
        type="submit"
        appearance="primary"
        shape="circular"
        icon-only
        :disabled="!input.trim()"
        aria-label="打开"
      >
        <ArrowRight :size="18" aria-hidden="true" />
      </FButton>
    </form>
    <p v-if="error" class="home-pill__error" role="alert">{{ error }}</p>

    <div class="home-grid">
      <section class="card home-announcement" aria-labelledby="home-announcement-title">
        <div class="home-card-head">
          <div class="cluster" style="gap: 8px">
            <h2 id="home-announcement-title">公告</h2>
            <span class="tag">{{ announcements.length }} 条</span>
          </div>
          <Megaphone :size="18" aria-hidden="true" />
        </div>

        <div v-if="loading" class="home-announcement__loading">
          <LoadingPanel variant="list" :rows="3" compact title="正在加载公告" />
        </div>
        <div v-else-if="failed" class="home-announcement__state">
          <div class="notice notice--warn" role="alert">
            <span>公告加载失败，请稍后刷新。</span>
            <FButton appearance="subtle" size="small" @click="loadAnnouncements">重试</FButton>
          </div>
        </div>
        <EmptyState v-else-if="!announcements.length" title="暂无公告" description="站长还没有发布公告。" />

        <template v-else>
          <Transition name="announcement-fade" mode="out-in">
            <div v-if="activeAnnouncement" :key="activeAnnouncement.id" class="home-announcement__body">
              <div class="flip-face__meta">
                <span class="tag tag--brand">{{ announcementIndex === 0 ? '最新公告' : '历史公告' }}</span>
                <time :datetime="activeAnnouncement.published_at">{{ formatDate(activeAnnouncement.published_at) }}</time>
              </div>
              <h3 class="home-announcement__title">{{ activeAnnouncement.title }}</h3>
              <MarkdownBody :source="activeAnnouncement.content" class="markdown-body home-announcement__content" />
            </div>
          </Transition>
          <div class="home-announcement__footer">
            <div class="home-announcement__pager">
              <FButton appearance="subtle" icon-only size="small" aria-label="上一条公告" :disabled="announcementIndex <= 0" @click="prevAnnouncement">
                <ChevronLeft :size="15" aria-hidden="true" />
              </FButton>
              <span class="home-announcement__count">{{ announcementIndex + 1 }} / {{ announcements.length }}</span>
              <FButton appearance="subtle" icon-only size="small" aria-label="下一条公告" :disabled="announcementIndex >= announcements.length - 1" @click="nextAnnouncement">
                <ChevronRight :size="15" aria-hidden="true" />
              </FButton>
            </div>
            <NuxtLink v-if="activeAnnouncement" :to="'/announcement?id=' + activeAnnouncement.id" class="flip-open">
              查看详情 <ChevronRight :size="13" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/announcement" class="home-more-link">
              全部公告 <ChevronRight :size="13" aria-hidden="true" />
            </NuxtLink>
          </div>
        </template>
      </section>

      <div class="home-stats" aria-label="站点统计">
        <article v-for="stat in statCards" :key="stat.label" class="card home-stat-card">
          <span class="home-stat-card__icon"><component :is="stat.icon" :size="20" aria-hidden="true" /></span>
          <span class="home-stat-card__label">{{ stat.label }}</span>
          <strong v-if="overview" class="home-stat-card__value">{{ formatCount(stat.value) }}</strong>
          <span v-else-if="overviewStatus === 'pending' || overviewStatus === 'idle'" class="skeleton home-stat-skeleton" aria-hidden="true" />
          <strong v-else class="home-stat-card__value">—</strong>
        </article>
      </div>
    </div>
  </div>

  <div v-else class="page page--medium">
    <PageHeader
      title="站点公告"
      description="洛谷档案馆的维护通知、规则调整与功能更新。"
      eyebrow="Announcement"
    >
      <template #icon><Megaphone :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton v-if="selected" appearance="outline" @click="navigateTo('/announcement')">
          <template #start><ArrowRight :size="16" style="transform: rotate(180deg)" aria-hidden="true" /></template>
          全部公告
        </FButton>
      </template>
    </PageHeader>

    <LoadingPanel v-if="loading" title="正在加载公告" compact />

    <div v-else-if="failed" class="card card__body stack">
      <div class="notice notice--warn"><span>公告加载失败，请稍后重试。</span></div>
      <div><FButton appearance="outline" @click="loadAnnouncements"><template #start><RefreshCw :size="15" /></template>重试</FButton></div>
    </div>

    <div v-else-if="selected" class="card">
      <div class="doc-header">
        <NuxtLink to="/announcement" class="cluster" style="font-size: 12px; color: var(--colorNeutralForeground3)">
          <ArrowRight :size="14" style="transform: rotate(180deg)" aria-hidden="true" />返回公告列表
        </NuxtLink>
        <h1 class="doc-title">{{ selected.title }}</h1>
        <span class="meta-item muted">
          <Megaphone :size="14" aria-hidden="true" />
          {{ formatDate(selected.published_at) }}
        </span>
      </div>
      <div class="divider" />
      <article class="doc-content">
        <div ref="announcementContent">
          <MarkdownBody :source="selected.content" class="markdown-body" />
        </div>
      </article>
    </div>

    <template v-else>
      <div v-if="selectedId" class="notice notice--warn"><span>未找到这条公告，以下为现有公告。</span></div>
      <EmptyState v-if="!announcements.length" title="暂无公告" description="站长还没有发布任何公告。" />
      <div v-else class="card list">
        <NuxtLink
          v-for="item in announcements"
          :key="item.id"
          :to="'/announcement?id=' + item.id"
          class="list-item list-item-link"
        >
          <div class="list-item__main">
            <span class="meta-item muted">{{ formatDate(item.published_at) }}</span>
            <span class="list-item__title">{{ item.title }}</span>
            <p v-if="item.summary" class="muted" style="font-size: 13px">{{ item.summary }}</p>
          </div>
          <ChevronRight :size="18" class="muted" aria-hidden="true" style="align-self: center; flex-shrink: 0" />
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-search {
  display: flex;
  gap: 8px;
  align-items: stretch;
  margin-top: 6px;
  max-width: 680px;
}
.home-search__field {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
}
.home-search__icon {
  position: absolute;
  left: 12px;
  z-index: 1;
  color: var(--colorNeutralForeground3);
  pointer-events: none;
}
.home-search__field :deep(fluent-text-input) { width: 100%; }
.home-search__field :deep(fluent-text-input::part(root)) { padding-left: 40px; height: 40px; }
.home-search__error {
  color: var(--colorPaletteRedForeground1, #b10e1c);
  font-size: 12px;
  margin-top: 4px;
}
.notice-link { text-decoration: none; color: var(--colorNeutralForeground1); transition: box-shadow var(--app-transition); }
.notice-link:hover { text-decoration: none; box-shadow: var(--shadow4); color: var(--colorNeutralForeground1); }
.notice-link__main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.list-item-link { text-decoration: none; color: inherit; }
.list-item-link:hover { text-decoration: none; background: var(--colorNeutralBackground1Hover); }
.list-item-link:hover .list-item__title { color: var(--colorBrandForeground1); }
@media (max-width: 680px) {
  .home-search { flex-direction: column; }
  .home-search :deep(.f-button) { width: 100%; }
}

.home-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 0 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.home-brand { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; margin-top: 10px; }
.home-brand__logo { width: 64px; height: 64px; border-radius: 16px; box-shadow: var(--shadow4); }
.home-brand__title { font-size: clamp(38px, 6vw, 58px); line-height: 1.1; font-weight: 700; letter-spacing: -0.03em; margin-top: 6px; }
.home-brand__subtitle { color: var(--colorNeutralForeground3); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; }
.home-pill {
  display: flex; align-items: center; gap: 8px;
  width: min(100%, 840px);
  margin: 0 auto;
  padding: 6px 6px 6px 18px;
  border: 1px solid var(--colorNeutralStroke2);
  border-radius: 999px;
  background: var(--colorNeutralBackground1);
  box-shadow: var(--shadow4);
  transition: box-shadow var(--app-transition), border-color var(--app-transition);
}
.home-pill:focus-within { border-color: var(--colorBrandStroke1); box-shadow: var(--shadow8); }
.home-pill__icon { color: var(--colorNeutralForeground3); flex-shrink: 0; }
.home-pill__input { flex: 1 1 auto; min-width: 0; }
.home-pill__input :deep(fluent-text-input) { width: 100%; }
.home-pill__input :deep(fluent-text-input::part(root)) {
  border: 0; background: transparent; height: 44px; padding-left: 2px; box-shadow: none;
}
.home-pill__submit { flex-shrink: 0; }
.home-pill__error { color: var(--colorPaletteRedForeground1, #b10e1c); font-size: 12px; text-align: center; margin: -12px 0 0; }
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, .8fr);
  gap: 18px;
  align-items: stretch;
  margin-top: 8px;
}
.home-announcement { display: flex; flex-direction: column; overflow: hidden; min-height: 430px; }
.home-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 18px 22px; border-bottom: 1px solid var(--colorNeutralStroke2);
  color: var(--colorNeutralForeground1);
}
.home-card-head h2 { font-size: 18px; font-weight: 600; }
.home-card-head svg { color: var(--colorNeutralForeground3); }
.home-announcement__body { flex: 1 1 auto; min-height: 0; max-height: 58vh; overflow-y: auto; padding: 18px 22px; }
.home-announcement__content { font-size: 14.5px; line-height: 1.85; }
.home-announcement__footer { border-top: 1px solid var(--colorNeutralStroke2); padding: 10px 22px; display: flex; justify-content: flex-end; }
.home-more-link { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--colorBrandForegroundLink); text-decoration: none; }
.home-more-link:hover { text-decoration: underline; }
.home-stats { display: flex; flex-direction: column; gap: 18px; }
.home-stat-card {
  flex: 1 1 0; min-height: 130px;
  padding: 18px 20px;
  display: flex; flex-direction: column; justify-content: center; gap: 5px;
}
.home-stat-card__icon {
  display: grid; place-items: center; width: 40px; height: 40px;
  border-radius: var(--borderRadiusLarge);
  background: var(--colorBrandBackground2); color: var(--colorBrandForeground1);
  margin-bottom: 4px;
}
.home-stat-card__label { color: var(--colorNeutralForeground3); font-size: 12px; }
.home-stat-card__value { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
@media (min-width: 901px) {
  .home-page { min-height: calc(100dvh - 96px); justify-content: center; }
}
@media (max-width: 900px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); }
  .home-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-announcement { min-height: 0; }
  .home-announcement__body { max-height: none; }
}
@media (max-width: 680px) {
  .home-page { gap: 18px; padding-top: 4px; }
  .home-brand__logo { width: 54px; height: 54px; }
  .home-brand__title { font-size: 36px; }
  .home-pill { padding: 4px 4px 4px 14px; }
  .home-pill__input :deep(fluent-text-input::part(root)) { height: 40px; }
  .home-card-head, .home-announcement__body { padding-inline: 16px; }
  .home-announcement__footer { padding-inline: 16px; }
  .home-stat-card { min-height: 108px; padding: 14px 16px; }
  .home-stat-card__value { font-size: 26px; }
}

/* 2026 refinement: single-line brand, compact grid and 3D announcement flip. */
.home-page { gap: 20px; padding: 6px 0 24px; }
.home-brand { gap: 2px; margin-top: 0; }
.home-brand__logo { width: 58px; height: 58px; border-radius: 14px; }
.home-brand__row {
  display: flex; align-items: baseline; justify-content: center;
  gap: 12px; flex-wrap: nowrap; margin-top: 2px;
}
.home-brand__title { font-size: clamp(34px, 4.6vw, 50px); margin: 0; white-space: nowrap; }
.home-brand__subtitle { font-size: 11px; white-space: nowrap; letter-spacing: .18em; }
.home-grid {
  grid-template-columns: minmax(0, 1.55fr) minmax(240px, .75fr);
  gap: 16px; margin-top: 0; align-items: stretch;
}
.home-announcement { min-height: 0; height: clamp(320px, 36vh, 360px); }
.home-card-head { padding: 13px 18px; }
.home-card-head h2 { font-size: 17px; }
.home-announcement__loading, .home-announcement__state { padding: 14px 18px; }
.flip-stage { flex: 1 1 auto; min-height: 0; perspective: 1400px; padding: 12px 16px 4px; }
.flip-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform .62s cubic-bezier(.2, .8, .2, 1);
}
.flip-inner.is-flipped { transform: rotateY(180deg); }
.flip-inner.no-transition { transition: none; }
.flip-face {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; gap: 8px;
  padding: 4px 4px 2px;
  background: var(--colorNeutralBackground1);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}
.flip-back { transform: rotateY(180deg); }
.flip-face__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.flip-face__meta time { margin-left: auto; color: var(--colorNeutralForeground3); font-size: 11px; }
.flip-face__title { font-size: 17px; line-height: 1.35; margin: 0; overflow-wrap: anywhere; }
.flip-face__content {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
  font-size: 13.5px; line-height: 1.72; padding-right: 4px;
  scrollbar-width: thin;
}
.flip-face__content :deep(> :first-child) { margin-top: 0; }
.flip-face__content :deep(> :last-child) { margin-bottom: 0; }
.flip-open {
  display: inline-flex; align-items: center; gap: 3px; align-self: flex-start;
  color: var(--colorBrandForegroundLink); font-size: 12px; text-decoration: none;
}
.flip-open:hover { text-decoration: underline; }
.flip-controls {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-top: 1px solid var(--colorNeutralStroke2);
  flex-shrink: 0;
}
.flip-dots { display: flex; align-items: center; gap: 5px; margin: 0 4px; }
.flip-dot {
  width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%;
  background: var(--colorNeutralStroke1); cursor: pointer;
  transition: width var(--durationNormal) var(--curveEasyEase), background var(--durationNormal) var(--curveEasyEase);
}
.flip-dot.is-active { width: 18px; border-radius: 3px; background: var(--colorBrandBackground); }
.home-more-link { margin-left: auto; }
.home-stats { gap: 16px; }
.home-stat-card { min-height: 0; padding: 15px 18px; }
.home-stat-card__icon { width: 36px; height: 36px; margin-bottom: 2px; }
.home-stat-card__value { font-size: 28px; }
.home-stat-skeleton { width: 58%; height: 30px; border-radius: var(--borderRadiusMedium); }
@media (max-width: 900px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); }
  .home-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-announcement { height: 360px; }
  .home-brand__row { gap: 8px; }
}
@media (max-width: 680px) {
  .home-page { gap: 16px; padding-top: 2px; }
  .home-brand__logo { width: 50px; height: 50px; }
  .home-brand__title { font-size: 32px; }
  .home-brand__subtitle { font-size: 9px; }
  .home-announcement { height: 350px; }
  .home-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-stat-card { min-height: 108px; padding: 13px 14px; }
  .home-stat-card__value { font-size: 24px; }
  .flip-stage { padding: 10px 12px 2px; }
  .flip-face__title { font-size: 15.5px; }
}

/* Brand: logo + title on one line, tagline underneath. */
.home-brand { gap: 8px; margin-top: 0; }
.home-brand__main {
  display: flex; align-items: center; justify-content: center;
  gap: 14px; flex-wrap: nowrap;
}
.home-brand__logo {
  width: 56px; height: 56px; border-radius: 0; box-shadow: none;
  background: none; flex-shrink: 0;
}
.home-brand__title {
  font-size: clamp(34px, 4.6vw, 50px); margin: 0; line-height: 1.08;
  white-space: nowrap; letter-spacing: -0.03em;
}
.home-brand__subtitle {
  display: block; margin: 0; font-size: 11px; line-height: 1.4;
  letter-spacing: .18em; white-space: nowrap;
}
.home-announcement__body {
  display: flex; flex-direction: column; gap: 8px;
  flex: 1 1 auto; min-height: 0; max-height: none;
  padding: 14px 18px 10px; overflow: hidden;
}
.home-announcement__title { margin: 0; font-size: 17px; line-height: 1.4; overflow-wrap: anywhere; }
.home-announcement__content {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
  font-size: 13.5px; line-height: 1.75; padding-right: 2px;
  scrollbar-width: thin;
}
.home-announcement__content :deep(> :first-child) { margin-top: 0; }
.home-announcement__content :deep(> :last-child) { margin-bottom: 0; }
.home-announcement__footer {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  border-top: 1px solid var(--colorNeutralStroke2);
  padding: 9px 18px; flex-shrink: 0;
}
.home-pill__submit {
  width: 36px; height: 36px; min-width: 36px; padding: 0;
  flex: 0 0 36px;
}
.home-pill__submit :deep(fluent-button::part(button)) { min-width: 36px; width: 36px; padding: 0; }
@media (max-width: 680px) {
  .home-brand__main { gap: 10px; }
  .home-brand__logo { width: 48px; height: 48px; }
  .home-brand__title { font-size: 32px; }
  .home-brand__subtitle { font-size: 9px; }
}
</style>
