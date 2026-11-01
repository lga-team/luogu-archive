<script setup lang="ts">
import {
  ArrowRight, BadgeCheck, Filter, FolderOpen, LayoutGrid, Plus, RefreshCw, RotateCcw,
  SlidersHorizontal, Sparkles, Tags,
} from 'lucide-vue-next'
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
function applyFilters() {
  page.value = 1
  void load()
}
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
  <div class="page page--medium plugin-market">
    <PageHeader
      title="插件广场"
      description="浏览经管理组审核的洛谷档案馆插件与请求说明。"
      eyebrow="Plugins"
    >
      <template #icon><Tags :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span v-if="!loaded && loading" class="skeleton skeleton--line" style="width: 120px; height: 12px; display: inline-block" aria-hidden="true" />
            <span v-else class="meta-item" role="status">{{ loaded ? `共 ${total} 个插件` : '插件列表' }}</span>
      </template>
      <template #actions>
        <FButton appearance="subtle" icon-only :disabled="loading" title="重新读取列表" aria-label="重新读取列表" @click="load">
          <RefreshCw :size="15" aria-hidden="true" />
        </FButton>
        <FButton appearance="outline" @click="navigateTo('/plugin/manage')">
          <template #start><FolderOpen :size="15" aria-hidden="true" /></template>我的插件
        </FButton>
        <FButton appearance="primary" @click="navigateTo('/plugin/submit')">
          <template #start><Plus :size="15" aria-hidden="true" /></template>提交插件
        </FButton>
      </template>
    </PageHeader>

    <div class="market-shell">
      <aside class="filter-sidebar" aria-label="插件筛选">
        <div class="card filter-card">
          <div class="card__header" style="padding: 14px 16px">
            <h2 class="card__title" style="font-size: 14px; display:flex;align-items:center;gap:7px">
              <Filter :size="15" aria-hidden="true" />筛选
            </h2>
            <FButton v-if="hasFilters" appearance="subtle" size="small" @click="resetFilters">
              <template #start><RotateCcw :size="13" aria-hidden="true" /></template>清除
            </FButton>
          </div>
          <div class="card__body filter-body">
            <div class="filter-group">
              <span class="filter-title"><Tags :size="14" aria-hidden="true" />功能标签</span>
              <div class="tag-options" role="group" aria-label="功能标签">
                <button type="button" class="tag-option" :class="{ 'is-active': !filters.tag_id }" @click="selectTag('')">
                  <LayoutGrid :size="14" aria-hidden="true" /><span>全部插件</span>
                </button>
                <div v-if="tagsLoading" class="stack stack--xs" aria-hidden="true"><span class="skeleton skeleton--line" style="width: 70%" /><span class="skeleton skeleton--line" style="width: 50%" /></div>
                <div v-else-if="tagError" class="field-help">
                  标签加载失败
                  <FButton appearance="subtle" size="small" @click="loadTags">重试</FButton>
                </div>
                <button
                  v-for="(tag, index) in tags"
                  :key="tag.id"
                  type="button"
                  class="tag-option"
                  :class="['tag-color-' + index % 6, { 'is-active': filters.tag_id === String(tag.id) }]"
                  @click="selectTag(String(tag.id))"
                >
                  <span class="tag-dot" aria-hidden="true" /><span>{{ tag.name }}</span>
                </button>
              </div>
            </div>

            <form class="filter-group" @submit.prevent="applyFilters">
              <span class="filter-title"><SlidersHorizontal :size="14" aria-hidden="true" />筛选条件</span>
              <div class="filter-fields">
                <div v-for="field in filterFields" :key="field.key" class="stack stack--xs">
                  <label :for="'plugin-filter-' + field.key" class="field-label">{{ field.label }}</label>
                  <FSelect
                    :id="'plugin-filter-' + field.key"
                    v-model="filters[field.key]"
                    :options="field.options"
                    size="small"
                  />
                </div>
              </div>
              <FButton type="submit" appearance="outline" size="small" block style="margin-top: 12px">
                <template #start><Filter :size="14" aria-hidden="true" /></template>应用筛选
              </FButton>
            </form>
          </div>
        </div>
      </aside>

      <section class="results-pane" aria-label="插件列表" :aria-busy="loading">
        <div class="results-heading">
          <h2 class="section-title">{{ activeTagName }}</h2>
          <div class="cluster">
            <FSelect v-model="sortMode" :options="sortOptions" size="small" aria-label="插件排序" style="width: 160px" @change="applyFilters" />
          </div>
        </div>

        <LoadingPanel v-if="loading" variant="list" :rows="4" title="正在加载插件" />

        <div v-else-if="errorText" class="card card__body">
          <EmptyState title="插件列表加载失败" :description="errorText">
            <template #actions>
              <FButton appearance="outline" @click="load">
                <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重新读取
              </FButton>
            </template>
          </EmptyState>
        </div>

        <div v-else-if="rows.length" class="plugin-list">
          <article v-for="row in rows" :key="row.article_id" class="card card--interactive plugin-row">
            <div class="row-heading">
              <NuxtLink :to="'/plugin/' + row.article_id" class="plugin-title">{{ row.article_title || row.article_id }}</NuxtLink>
              <PluginRequestLevelBadge :level="row.final_request_level" compact />
            </div>
            <p v-if="row.summary" class="plugin-summary">{{ displaySummary(row.summary) }}</p>
            <div class="row-meta">
              <span v-if="row.article_author" class="article-author">
                <LuoguAvatar :user="row.article_author" :size="24" />
                <LuoguUserName :user="row.article_author" show-badge />
              </span>
              <span class="meta-item">{{ runtimeMode(row.runtime_mode) }}</span>
              <time v-if="row.updated_at" class="meta-item" :datetime="row.updated_at" :title="format(row.updated_at, 'YYYY-MM-DD HH:mm:ss')">更新于 {{ smart(row.updated_at) }}</time>
              <span class="meta-item">近 30 天 {{ row.usage_30d || 0 }} 次使用</span>
            </div>
            <footer class="row-footer">
              <div class="badges">
                <span v-if="row.is_official" class="tag tag--brand"><BadgeCheck :size="12" aria-hidden="true" />官方插件</span>
                <span v-if="row.is_recommended" class="tag tag--warn"><Sparkles :size="12" aria-hidden="true" />推荐插件</span>
                <span v-for="tag in row.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
              </div>
              <NuxtLink :to="'/plugin/' + row.article_id" class="detail-link" :aria-label="'查看插件：' + (row.article_title || row.article_id)">
                <ArrowRight :size="16" aria-hidden="true" />
              </NuxtLink>
            </footer>
          </article>
        </div>

        <EmptyState
          v-else
          title="没有符合条件的插件"
          :description="hasFilters ? '可以清除筛选条件后再试。' : '还没有已归档的插件。'"
        >
          <template #actions>
            <FButton v-if="hasFilters" appearance="outline" @click="resetFilters">
              <template #start><RotateCcw :size="14" aria-hidden="true" /></template>清除筛选
            </FButton>
          </template>
        </EmptyState>

        <ArchivePagination v-if="!errorText && totalPages > 1" :page="page" :total-pages="totalPages" :pending="loading" @page="goPage" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.market-shell { display: grid; grid-template-columns: 228px minmax(0, 1fr); gap: 16px; align-items: start; }
.filter-sidebar { position: sticky; top: 16px; }
.filter-body { display: flex; flex-direction: column; gap: 18px; padding: 14px 16px; }
.filter-group { display: flex; flex-direction: column; gap: 8px; }
.filter-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--colorNeutralForeground3); }
.tag-options { display: flex; flex-direction: column; gap: 1px; }
.tag-option {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 9px; border: 0; border-radius: var(--borderRadiusMedium);
  background: transparent; color: var(--colorNeutralForeground2);
  font-size: 12.5px; text-align: left; cursor: pointer;
}
.tag-option:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorNeutralForeground1); }
.tag-option.is-active { background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-weight: 600; }
.tag-option span:last-child { min-width: 0; overflow-wrap: anywhere; }
.tag-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--colorBrandBackground); flex-shrink: 0; }
.tag-color-1 .tag-dot { background: #F39C11; }
.tag-color-2 .tag-dot { background: #9D3DCF; }
.tag-color-3 .tag-dot { background: #52C41A; }
.tag-color-4 .tag-dot { background: #13C2C2; }
.tag-color-5 .tag-dot { background: #E74C3C; }
.filter-fields { display: flex; flex-direction: column; gap: 10px; }
.results-pane { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.results-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.plugin-list { display: flex; flex-direction: column; gap: 10px; }
.plugin-row { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; }
.row-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; }
.plugin-title { min-width: 0; color: var(--colorNeutralForeground1); font-size: 17px; font-weight: 600; line-height: 1.45; text-decoration: none; overflow-wrap: anywhere; }
.plugin-title:hover { color: var(--colorBrandForeground1); text-decoration: none; }
.plugin-summary { color: var(--colorNeutralForeground3); font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
.row-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; color: var(--colorNeutralForeground3); font-size: 11.5px; }
.article-author { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.row-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke2); }
.badges { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; min-width: 0; }
.badges .tag { gap: 4px; }
.detail-link { display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--borderRadiusMedium); color: var(--colorNeutralForeground3); flex-shrink: 0; }
.detail-link:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorBrandForeground1); }
.filter-toggle { display: none; }
@media (max-width: 900px) {
  .market-shell { display: flex; flex-direction: column; gap: 12px; }
  .filter-sidebar { display: block; position: static; order: 0; width: 100%; }
  .filter-card { width: 100%; }
  .filter-body { display: block; }
  .tag-options { flex-direction: row; flex-wrap: wrap; }
  .tag-option { width: auto; flex: 0 0 auto; }
  .filter-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .filter-toggle { display: none !important; }
  .results-pane { order: 1; width: 100%; }
  .tag-options { flex-direction: row; flex-wrap: wrap; }
  .tag-option { width: auto; }
  .filter-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .plugin-row { padding: 15px; }
  .row-heading { flex-wrap: wrap; }
  .plugin-title { font-size: 16px; }
  .filter-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
