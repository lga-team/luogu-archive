<script setup lang="ts">
import { ArrowRight, BadgeCheck, Filter, FolderOpen, LayoutGrid, Plus, RefreshCw, RotateCcw, SlidersHorizontal, Sparkles, Tags } from 'lucide-vue-next'
import { Button, Select } from '~/components/ui'
import type { PluginTag } from '~/types/plugin'

interface MarketItem {
  article_id: string
  article_title: string
  article_author: {
    uid: number; name: string; color: string; badge: string | null; avatar: string | null
    ccf_level?: number; xcpc_level?: number; is_admin?: boolean
  } | null
  summary: string
  final_request_level: number
  runtime_mode: string
  updated_at: string
  usage_30d: number
  is_official: boolean
  is_recommended: boolean
  tags: PluginTag[]
}
const api = useApi()
const { runtimeMode } = usePluginLabels()
const { format, smart } = useTime()
const pageSize = 20
const tags = ref<PluginTag[]>([])
const rows = ref<MarketItem[]>([])
const total = ref(0)
const page = ref(1)
const sortMode = ref('smart')
const loading = ref(true)
const loaded = ref(false)
const errorText = ref('')
const tagError = ref(false)
const tagsLoading = ref(true)
const appliedTag = ref('')
const filters = reactive({ tag_id: '', request_level: '', runtime_mode: '', device: '', badge: '', updated_days: '' })
const filterFields: Array<{ key: keyof typeof filters; label: string; options: { value: string; label: string }[] }> = [
  { key: 'request_level', label: '请求等级', options: [
    { value: '', label: '全部等级' }, { value: '0', label: '0 · 无请求' }, { value: '1', label: '1 · 少请求' }, { value: '2', label: '2 · 中等请求' }, { value: '3', label: '3 · 较多请求' },
  ] },
  { key: 'runtime_mode', label: '运行方式', options: [
    { value: '', label: '全部方式' }, { value: 'userscript', label: '用户脚本' }, { value: 'extension', label: '浏览器扩展' }, { value: 'bookmarklet', label: '书签脚本' }, { value: 'other', label: '其他' },
  ] },
  { key: 'device', label: '兼容设备', options: [
    { value: '', label: '全部设备' }, { value: 'desktop', label: '桌面端' }, { value: 'mobile', label: '移动端' },
  ] },
  { key: 'badge', label: '可信徽章', options: [
    { value: '', label: '全部徽章' }, { value: 'official', label: '官方插件' }, { value: 'recommended', label: '推荐插件' },
  ] },
  { key: 'updated_days', label: '更新时间', options: [
    { value: '', label: '不限时间' }, { value: '7', label: '最近 7 天' }, { value: '30', label: '最近 30 天' }, { value: '90', label: '最近 90 天' },
  ] },
]
const sortOptions = [
  { value: 'smart', label: '智能排序' }, { value: 'latest', label: '最近更新' },
  { value: 'usage', label: '近期使用最多' }, { value: 'verified', label: '最近验证' },
]
const hasFilters = computed(() => Object.values(filters).some(Boolean))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const activeTagName = computed(() => !appliedTag.value ? '全部插件' : tags.value.find(tag => String(tag.id) === appliedTag.value)?.name || '筛选结果')
let controller: AbortController | undefined
let requestId = 0
let disposed = false

function displaySummary(value: string) {
  const chars = Array.from((value || '').trim())
  return chars.length <= 50 ? chars.join('') : chars.slice(0, 49).join('') + '…'
}
function hasBadges(row: MarketItem) {
  return Boolean(row.is_official || row.is_recommended || row.tags?.length)
}
async function loadTags() {
  tagsLoading.value = true
  tagError.value = false
  try {
    const result = await api<PluginTag[]>('/plugins/tags')
    if (!disposed) tags.value = result
  } catch {
    if (!disposed) tagError.value = true
  } finally {
    if (!disposed) tagsLoading.value = false
  }
}
async function load() {
  controller?.abort()
  controller = new AbortController()
  const current = ++requestId
  loading.value = true
  errorText.value = ''
  appliedTag.value = filters.tag_id
  const query: Record<string, string | number | boolean> = { page: page.value, page_size: pageSize, sort: sortMode.value }
  if (filters.tag_id) query.tag_id = filters.tag_id
  if (filters.request_level !== '') query.request_level = filters.request_level
  if (filters.runtime_mode) query.runtime_mode = filters.runtime_mode
  if (filters.device) query.device = filters.device
  if (filters.badge === 'official') query.official = true
  if (filters.badge === 'recommended') query.recommended = true
  if (filters.updated_days) query.updated_within_days = filters.updated_days
  try {
    const result = await api<{ items: MarketItem[]; total: number }>('/plugins', { query, signal: controller.signal })
    if (disposed || current !== requestId) return
    rows.value = result.items
    total.value = result.total
    loaded.value = true
  } catch (error: any) {
    if (!disposed && current === requestId) errorText.value = error?.data?.message || '插件列表加载失败，请稍后重试。'
  } finally {
    if (!disposed && current === requestId) loading.value = false
  }
}
function applyFilters() { page.value = 1; void load() }
function selectTag(id: string) { filters.tag_id = id; applyFilters() }
function resetFilters() {
  Object.assign(filters, { tag_id: '', request_level: '', runtime_mode: '', device: '', badge: '', updated_days: '' })
  applyFilters()
}
function goPage(next: number) {
  if (loading.value || next === page.value || next < 1 || next > totalPages.value) return
  page.value = next
  void load()
}
onMounted(() => { void loadTags(); void load() })
onBeforeUnmount(() => { disposed = true; requestId++; controller?.abort() })
useHead({ title: '插件广场 - 洛谷档案馆' })
</script>

<template>
  <div class="archive-ui plugin-market">
    <header class="judgement-header-stack">
      <ArchivePageHeader title="插件广场" description="浏览经管理组审核的插件与请求说明" icon="plugin" />
      <div class="archive-card judgement-toolbar">
        <div class="archive-card-footer judgement-heading-footer">
          <span class="judgement-heading-updated" role="status">{{ loaded ? '共 ' + total + ' 个插件' : loading ? '正在读取插件列表…' : '插件列表' }}</span>
          <div class="judgement-heading-actions market-actions">
            <Button variant="outline" size="icon" class="market-refresh" :disabled="loading" title="重新读取列表" aria-label="重新读取列表" @click="load"><RefreshCw :size="14" aria-hidden="true" /></Button>
            <Button variant="outline" size="sm" as-child><NuxtLink to="/plugin/manage"><FolderOpen :size="14" aria-hidden="true" />我的插件</NuxtLink></Button>
            <Button variant="outline" size="sm" as-child><NuxtLink to="/plugin/submit"><Plus :size="14" aria-hidden="true" />提交插件</NuxtLink></Button>
          </div>
        </div>
      </div>
    </header>

    <div class="market-shell">
      <aside class="filter-sidebar" aria-label="插件筛选">
        <div class="archive-card market-filter-panel">
          <h2 class="sidebar-title"><Tags :size="16" aria-hidden="true" />功能标签</h2>
          <div class="tag-options" role="group" aria-label="功能标签">
            <Button variant="ghost" class="tag-option" :aria-pressed="!filters.tag_id" @click="selectTag('')"><LayoutGrid :size="14" aria-hidden="true" /><span>全部插件</span></Button>
            <p v-if="tagsLoading" class="filter-status" role="status">正在读取标签…</p>
            <div v-else-if="tagError" class="filter-status" role="alert"><p>标签加载失败</p><Button variant="ghost" size="sm" @click="loadTags"><RefreshCw :size="14" aria-hidden="true" />重试</Button></div>
            <Button v-for="(tag, index) in tags" :key="tag.id" variant="ghost" class="tag-option" :class="'tag-color-' + index % 6" :aria-pressed="filters.tag_id === String(tag.id)" @click="selectTag(String(tag.id))"><span class="tag-dot" aria-hidden="true" /><span>{{ tag.name }}</span></Button>
          </div>

          <form class="filter-form" @submit.prevent="applyFilters">
            <h2 class="sidebar-title"><SlidersHorizontal :size="16" aria-hidden="true" />筛选条件</h2>
            <div class="filter-fields">
              <div v-for="field in filterFields" :key="field.key" class="filter-field">
                <label :for="'plugin-filter-' + field.key">{{ field.label }}</label>
                <Select :id="'plugin-filter-' + field.key" v-model="filters[field.key]" :options="field.options" />
              </div>
            </div>
            <div class="filter-actions">
              <Button type="submit" variant="outline" size="sm"><Filter :size="14" aria-hidden="true" />应用筛选</Button>
              <Button variant="ghost" size="icon" class="filter-reset" :disabled="!hasFilters" title="清除筛选" aria-label="清除筛选" @click="resetFilters"><RotateCcw :size="15" aria-hidden="true" /></Button>
            </div>
          </form>
        </div>
      </aside>

      <section class="results-pane" aria-label="插件列表" :aria-busy="loading">
        <header class="results-heading">
          <h2>{{ activeTagName }}</h2>
          <div class="sort-control"><label for="plugin-sort">排序</label><Select id="plugin-sort" v-model="sortMode" class="market-sort-select" :options="sortOptions" aria-label="插件排序" @change="applyFilters" /></div>
        </header>

        <LoadingPanel v-if="loading" title="正在加载插件" text="" />
        <div v-else-if="errorText" class="market-state" role="alert"><p>{{ errorText }}</p><Button variant="outline" size="sm" @click="load"><RefreshCw :size="14" aria-hidden="true" />重新读取</Button></div>
        <div v-else-if="rows.length" class="plugin-list">
          <article v-for="row in rows" :key="row.article_id" class="plugin-row archive-card">
            <div class="row-heading">
              <NuxtLink :to="'/plugin/' + row.article_id" class="plugin-title">{{ row.article_title || row.article_id }}</NuxtLink>
              <PluginRequestLevelBadge :level="row.final_request_level" compact />
            </div>
            <p v-if="row.summary" class="summary">{{ displaySummary(row.summary) }}</p>
            <div class="row-meta">
              <span v-if="row.article_author" class="article-author">
                <NuxtLink :to="'/user/' + row.article_author.uid" class="author-avatar" tabindex="-1" aria-hidden="true">
                  <img v-if="row.article_author.avatar" :src="row.article_author.avatar" alt="" width="28" height="28" loading="lazy">
                  <span v-else>{{ (row.article_author.name || '?').charAt(0).toUpperCase() }}</span>
                </NuxtLink>
                <LuoguUserName :user="row.article_author" show-badge />
              </span>
              <span class="meta-item">{{ runtimeMode(row.runtime_mode) }}</span>
              <time v-if="row.updated_at" class="meta-item" :datetime="row.updated_at" :title="format(row.updated_at, 'YYYY-MM-DD HH:mm:ss')">更新于 {{ smart(row.updated_at) }}</time>
              <span class="meta-item">近 30 天 {{ row.usage_30d || 0 }} 次有效使用</span>
              <NuxtLink v-if="!hasBadges(row)" :to="'/plugin/' + row.article_id" class="detail-link" :aria-label="'查看插件：' + (row.article_title || row.article_id)" title="查看插件"><ArrowRight :size="17" aria-hidden="true" /></NuxtLink>
            </div>
            <footer v-if="hasBadges(row)" class="row-footer">
              <div class="badges">
                <span v-if="row.is_official" class="trust official"><BadgeCheck :size="13" aria-hidden="true" />官方插件</span>
                <span v-if="row.is_recommended" class="trust recommended"><Sparkles :size="13" aria-hidden="true" />推荐插件</span>
                <span v-for="tag in row.tags" :key="tag.id" class="plugin-tag">{{ tag.name }}</span>
              </div>
              <NuxtLink :to="'/plugin/' + row.article_id" class="detail-link" :aria-label="'查看插件：' + (row.article_title || row.article_id)" title="查看插件"><ArrowRight :size="17" aria-hidden="true" /></NuxtLink>
            </footer>
          </article>
        </div>
        <div v-else class="market-state"><p>没有符合条件的插件</p><Button v-if="hasFilters" variant="outline" size="sm" @click="resetFilters"><RotateCcw :size="14" aria-hidden="true" />清除筛选</Button></div>

        <ArchivePagination v-if="!errorText && totalPages > 1" :page="page" :total-pages="totalPages" :pending="loading" @page="goPage" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.plugin-market { display: grid; gap: 16px; width: min(100%, 1180px); min-width: 0; margin: 0 auto; }
.market-actions { flex-wrap: wrap; }
.market-actions a { text-decoration: none; }
.archive-ui .market-refresh { width: 32px; height: 32px; flex-basis: 32px; border-radius: 6px; }
.market-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: start; min-width: 0; }
.filter-sidebar, .results-pane { min-width: 0; }
.market-filter-panel { display: block; padding: 20px; }
.sidebar-title { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 15px; font-weight: 600; }
.sidebar-title svg { color: var(--text-muted); flex-shrink: 0; }
.tag-options { display: grid; gap: 3px; }
.archive-ui .tag-option { width: 100%; height: auto; min-height: 36px; padding: 8px 10px; gap: 9px; justify-content: flex-start; color: var(--text); font-size: 13px; text-align: left; white-space: normal; }
.tag-option > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.archive-ui .tag-option[aria-pressed=true] { background: var(--hover); color: var(--link); }
.tag-dot { width: 10px; height: 10px; flex: 0 0 10px; border-radius: 2px; background: var(--lg-blue); }
.tag-color-1 .tag-dot { background: var(--lg-orange); }
.tag-color-2 .tag-dot { background: var(--lg-purple); }
.tag-color-3 .tag-dot { background: var(--lg-green); }
.tag-color-4 .tag-dot { background: var(--lg-cyan); }
.tag-color-5 .tag-dot { background: var(--lg-red); }
.filter-status { margin: 6px 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.filter-status p { margin: 0 0 4px; }
.filter-form { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
.filter-fields { display: grid; gap: 12px; }
.filter-field { display: grid; gap: 5px; min-width: 0; }
.filter-field > label { font-size: 13px; color: var(--text-muted); }
.filter-actions { display: grid; grid-template-columns: minmax(0, 1fr) 32px; align-items: center; gap: 8px; margin-top: 16px; }
.archive-ui .filter-reset { width: 32px; height: 32px; }
.results-pane { display: grid; gap: 14px; align-content: start; }
.results-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; min-height: 38px; }
.results-heading h2 { margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 18px; font-weight: 600; }
.sort-control { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; }
.sort-control .market-sort-select { width: 150px; }
.plugin-list { display: grid; gap: 12px; min-width: 0; }
.plugin-row { display: grid; gap: 12px; padding: 20px 24px; min-width: 0; transition: border-color .15s; }
.plugin-row:hover { border-color: var(--link); }
.row-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; }
.row-heading > :last-child { flex-shrink: 0; }
.plugin-title { min-width: 0; color: var(--text); font-size: 18px; font-weight: 600; line-height: 1.5; text-decoration: none; overflow-wrap: anywhere; }
.plugin-title:hover { color: var(--link); text-decoration: none; }
.summary { margin: 0; color: var(--text-muted); font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.row-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; color: var(--text-muted); font-size: 12px; line-height: 1.7; }
.article-author { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.article-author :deep(.lg-user-wrap) { flex-wrap: wrap; }
.author-avatar { display: inline-flex; flex: 0 0 28px; width: 28px; height: 28px; overflow: hidden; border-radius: 50%; text-decoration: none; }
.author-avatar img, .author-avatar > span { width: 100%; height: 100%; object-fit: cover; }
.author-avatar > span { display: grid; place-items: center; background: var(--hover); color: var(--text-muted); }
.meta-item { overflow-wrap: anywhere; }
.row-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.trust, .plugin-tag { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 7px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.official { color: var(--link); border-color: color-mix(in srgb, var(--link) 30%, var(--border)); background: color-mix(in srgb, var(--link) 7%, var(--surface)); }
.recommended { color: var(--text); border-color: color-mix(in srgb, var(--lg-yellow) 65%, var(--border)); background: color-mix(in srgb, var(--lg-yellow) 15%, var(--surface)); }
.trust svg { flex-shrink: 0; }
.plugin-tag { color: var(--text-muted); }
.detail-link { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 4px; color: var(--text-muted); }
.row-meta > .detail-link { margin-left: auto; }
.detail-link:hover { background: var(--hover); color: var(--link); }
.detail-link:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.market-state { display: grid; justify-items: center; gap: 14px; padding: 48px 20px; color: var(--text-muted); text-align: center; font-size: 14px; }
.market-state p { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 1000px) {
  .market-filter-panel { padding: 18px 16px; }
  .plugin-row { padding: 18px 20px; }
}
@media (max-width: 820px) {
  .market-shell { grid-template-columns: minmax(0, 1fr); }
  .market-filter-panel { padding: 16px; }
  .tag-options { display: flex; flex-wrap: wrap; gap: 4px; }
  .archive-ui .tag-option { width: auto; max-width: 100%; min-height: 32px; padding: 6px 10px; }
  .filter-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-actions { max-width: 230px; margin-left: auto; }
}
@media (max-width: 560px) {
  .market-actions { width: 100%; }
  .plugin-row { padding: 16px; }
  .row-heading { flex-wrap: wrap; }
  .plugin-title { font-size: 17px; }
  .results-heading { align-items: baseline; }
  .sort-control > label { display: none; }
}
@media (max-width: 360px) {
  .filter-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
