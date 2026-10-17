<script setup lang="ts">
import { ArrowRight, ArrowLeft, Search, Megaphone, ChevronRight, RefreshCw } from 'lucide-vue-next'
import { Button, Input } from './ui'
import { parseArchiveAddress } from '~/utils/parseArchiveAddress'
interface Announcement { id: number; title: string; summary: string; content: string; published_at: string }
const props = defineProps<{ page: 'home' | 'announcement' }>()
const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()
const input = ref('')
const error = ref('')
const announcements = ref<Announcement[]>([])
const loading = ref(true)
const failed = ref(false)
const read = ref<string[]>([])
const homeReady = ref(false)
const compact = ref(false)
const logo = ref<HTMLImageElement | null>(null)
const markdown = shallowRef<(value: string) => string>(() => '')
const readKey = 'archive-read-announcements-v1'
let disposed = false
let media: MediaQueryList | undefined
let request = 0
const selectedId = computed(() => Number(route.query.id) || null)
const selected = computed(() => announcements.value.find(item => item.id === selectedId.value))
const unread = computed(() => {
  const latest = announcements.value[0]
  return latest && !read.value.includes(announcementKey(latest)) ? latest : null
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
function openAddress() {
  try { error.value = ''; void navigateTo(parseArchiveAddress(input.value, Boolean(config.public.extendedArchiveModulesEnabled))) }
  catch (reason) { error.value = (reason as Error).message }
}
async function loadAnnouncements() {
  const current = ++request
  loading.value = true
  failed.value = false
  try {
    // 主页不下载 Markdown/KaTeX，也只获取最新一条公告。
    const items = await api<Announcement[]>('/site/announcements', { query: { limit: props.page === 'home' ? 1 : 50 } })
    if (props.page === 'announcement') {
      const module = await import('~/composables/useMarkdown')
      if (!disposed && current === request) markdown.value = module.useMarkdown().render
    }
    if (!disposed && current === request) announcements.value = items
  } catch {
    if (!disposed && current === request) failed.value = true
  } finally { if (!disposed && current === request) loading.value = false }
}
watch(selected, item => {
  if (!item || import.meta.server) return
  const next = Array.from(new Set([...readAnnouncements(), announcementKey(item)])).slice(-200)
  try { localStorage.setItem(readKey, JSON.stringify(next)) } catch {}
  read.value = next
})
function updateCompact() { compact.value = media?.matches || false }
onMounted(async () => {
  read.value = readAnnouncements()
  media = window.matchMedia('(max-width: 640px)')
  updateCompact()
  media.addEventListener('change', updateCompact)
  void loadAnnouncements()
  if (props.page === 'home') {
    await logo.value?.decode().catch(() => {})
    if (!disposed) homeReady.value = true
  }
})
onBeforeUnmount(() => { disposed = true; request++; media?.removeEventListener('change', updateCompact) })
</script>
<template>
  <div class="archive-ui" :style="page === 'home' && !homeReady ? { visibility: 'hidden' } : undefined">
    <template v-if="page === 'home'">
      <div class="archive-home-notice"><NuxtLink v-if="unread" class="archive-notice" :to="'/announcement?id=' + unread.id"><Megaphone :size="17" aria-hidden="true" /><span>新公告：{{ unread.title }}</span><ChevronRight :size="17" aria-hidden="true" /></NuxtLink></div>
      <section class="archive-home">
        <div class="archive-wordmark"><img ref="logo" src="/favicon.png" alt=""><h1>洛谷档案馆</h1></div>
        <form class="archive-search" @submit.prevent="openAddress">
          <Search class="archive-search-icon" :size="22" aria-hidden="true" />
          <Input v-model="input" aria-label="洛谷链接" :placeholder="compact ? '输入洛谷主站链接' : '输入洛谷主站的地址，打开对应页面'" autocomplete="off" :spellcheck="false" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'archive-search-error' : undefined" @update:model-value="error = ''" />
          <Button type="submit" size="icon" variant="ghost" title="打开对应页面" aria-label="打开对应页面" :disabled="!input.trim()"><ArrowRight :size="21" /></Button>
        </form>
        <p v-if="error" id="archive-search-error" class="archive-error" role="alert">{{ error }}</p>
      </section>
      <NuxtLink class="archive-announcement-entry" to="/announcement"><Megaphone :size="15" />站点公告</NuxtLink>
    </template>
    <section v-else class="archive-announcements">
      <ArchivePageHeader title="站点公告" description="洛谷档案馆站点通知与公告" icon="megaphone" />
      <div v-if="selected" class="archive-card judgement-toolbar"><div class="archive-card-footer judgement-heading-footer"><Button variant="outline" size="sm" as-child><NuxtLink to="/announcement"><ArrowLeft :size="14" aria-hidden="true" />全部公告</NuxtLink></Button></div></div>
      <p v-if="loading" role="status" class="archive-muted">正在加载公告…</p>
      <div v-else-if="failed" class="archive-load-error" role="alert"><p>公告加载失败，请稍后重试。</p><Button variant="outline" size="sm" @click="loadAnnouncements"><RefreshCw :size="14" aria-hidden="true" />重试</Button></div>
      <div v-else-if="selected" class="archive-card archive-announcement-detail"><article><h2 class="archive-detail-title">{{ selected.title }}</h2><time class="archive-muted" :datetime="selected.published_at">{{ formatDate(selected.published_at) }}</time><div class="markdown-body archive-announcement-content" v-html="markdown(selected.content)" /></article></div>
      <template v-else>
        <p v-if="selectedId" role="alert" class="archive-error">未找到这条公告，以下为现有公告。</p>
        <p v-if="!announcements.length" class="archive-muted">暂无公告。</p>
        <div class="archive-announcement-list"><div v-for="item in announcements" :key="item.id" class="archive-card archive-announcement-item"><article><NuxtLink :to="'/announcement?id=' + item.id"><div><time :datetime="item.published_at">{{ formatDate(item.published_at) }}</time><h2>{{ item.title }}</h2><p v-if="item.summary">{{ item.summary }}</p></div><ChevronRight :size="20" aria-hidden="true" /></NuxtLink></article></div></div>
      </template>
    </section>
  </div>
</template>
