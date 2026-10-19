<script setup lang="ts">
import { ArrowRight, ChevronDown, Plus, Tag, Wrench } from '@lucide/vue'
import type { PluginTag } from '~/types/plugin'

const api = useApi()
const { runtimeMode } = usePluginLabels()
const { format } = useTime()

const tags = ref<PluginTag[]>([])
const rows = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const sortMode = ref('smart')
const loading = ref(true)
const errorText = ref('')
const PAGE_SIZE = 20
const filters = reactive({
  tag_id: '',
  request_level: '',
  runtime_mode: '',
  device: '',
  badge: '',
  updated_days: '',
})

// Select 组件不接受空字符串作为选中值，用 all 代表"不限"，写入 filters 时再还原为空。
function filterModel(key: keyof typeof filters) {
  return computed({
    get: () => filters[key] || 'all',
    set: (value: string) => { filters[key] = value === 'all' ? '' : value },
  })
}

const requestLevelModel = filterModel('request_level')
const runtimeModeModel = filterModel('runtime_mode')
const deviceModel = filterModel('device')
const badgeModel = filterModel('badge')
const updatedDaysModel = filterModel('updated_days')

const TAG_DOT_COLORS = [
  'bg-[var(--lg-blue)]',
  'bg-[var(--lg-orange)]',
  'bg-[var(--lg-purple)]',
  'bg-[var(--lg-green)]',
  'bg-[var(--lg-cyan)]',
  'bg-[var(--lg-red)]',
]
const tagDotClass = (index: number) => TAG_DOT_COLORS[index % TAG_DOT_COLORS.length]

const activeTagName = computed(() => {
  if (!filters.tag_id) return '全部插件'
  return tags.value.find(tag => String(tag.id) === filters.tag_id)?.name || '筛选结果'
})

const hasFilters = computed(() => Object.values(filters).some(Boolean))
// 五个下拉默认收起，避免筛选区把列表推到首屏之外。
const filtersOpen = ref(false)
const DROPDOWN_FILTER_KEYS = ['request_level', 'runtime_mode', 'device', 'badge', 'updated_days'] as const
const dropdownFilterCount = computed(
  () => DROPDOWN_FILTER_KEYS.filter(key => filters[key]).length,
)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function displaySummary(value: unknown) {
  const chars = Array.from(String(value || '').trim())
  return chars.length <= 50 ? chars.join('') : `${chars.slice(0, 49).join('')}…`
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const query: Record<string, string | number | boolean> = {
      page: page.value,
      page_size: PAGE_SIZE,
      sort: sortMode.value,
    }
    if (filters.tag_id) query.tag_id = filters.tag_id
    if (filters.request_level !== '') query.request_level = filters.request_level
    if (filters.runtime_mode) query.runtime_mode = filters.runtime_mode
    if (filters.device) query.device = filters.device
    if (filters.badge === 'official') query.official = true
    if (filters.badge === 'recommended') query.recommended = true
    if (filters.updated_days) query.updated_within_days = filters.updated_days
    const data = await api<any>('/plugins', { query })
    rows.value = data.items
    total.value = data.total
  } catch (error: any) {
    errorText.value = error?.data?.message || '插件列表加载失败'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void load()
}

function applySort() {
  page.value = 1
  void load()
}

function selectTag(tagId: string) {
  filters.tag_id = tagId
  applyFilters()
}

function resetFilters() {
  Object.assign(filters, {
    tag_id: '',
    request_level: '',
    runtime_mode: '',
    device: '',
    badge: '',
    updated_days: '',
  })
  applyFilters()
}

function goPage(next: number) {
  page.value = next
  void load()
}

onMounted(async () => {
  try { tags.value = await api<PluginTag[]>('/plugins/tags') } catch {}
  await load()
})

useHead({ title: '插件广场 - 洛谷档案馆' })
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">插件广场</h1>
        <p class="mt-1 text-sm text-muted-foreground">浏览经管理组审核的洛谷插件与请求说明</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/plugin/manage">
            <Wrench class="size-3.5" />
            我的插件
          </NuxtLink>
        </Button>
        <Button size="sm" as-child>
          <NuxtLink to="/plugin/submit">
            <Plus class="size-3.5" />
            提交插件
          </NuxtLink>
        </Button>
      </div>
    </header>

    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card class="min-w-0 gap-0 py-0 lg:sticky lg:top-5">
        <div class="p-4">
          <p class="text-xs font-medium text-muted-foreground">功能标签</p>
          <div class="mt-2 flex flex-wrap gap-1 lg:flex-col">
            <Button
              variant="ghost"
              class="h-8 w-auto justify-start px-2 text-sm font-normal lg:w-full"
              :class="!filters.tag_id ? 'bg-accent text-foreground' : 'text-muted-foreground'"
              @click="selectTag('')"
            >
              <span class="size-2 shrink-0 rounded-sm bg-foreground" />
              全部插件
            </Button>
            <Button
              v-for="(tag, index) in tags"
              :key="tag.id"
              variant="ghost"
              class="h-8 w-auto justify-start px-2 text-sm font-normal lg:w-full"
              :class="filters.tag_id === String(tag.id) ? 'bg-accent text-foreground' : 'text-muted-foreground'"
              @click="selectTag(String(tag.id))"
            >
              <span class="size-2 shrink-0 rounded-sm" :class="tagDotClass(index)" />
              <span class="truncate">{{ tag.name }}</span>
            </Button>
          </div>

          <button
            type="button"
            class="mt-4 flex w-full items-center gap-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen"
          >
            <span>详细筛选</span>
            <Badge
              v-if="dropdownFilterCount"
              variant="secondary"
              class="h-4 min-w-4 px-1 text-[10px] font-normal tabular-nums"
            >
              {{ dropdownFilterCount }}
            </Badge>
            <ChevronDown
              class="ml-auto size-4 transition-transform"
              :class="filtersOpen ? 'rotate-180' : ''"
            />
          </button>

          <div
            class="mt-3 space-y-3"
            :class="filtersOpen ? '' : 'hidden'"
          >
            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">请求等级</Label>
              <Select v-model="requestLevelModel">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue placeholder="全部等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等级</SelectItem>
                  <SelectItem value="0">无请求</SelectItem>
                  <SelectItem value="1">少请求</SelectItem>
                  <SelectItem value="2">中等请求</SelectItem>
                  <SelectItem value="3">较多请求</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">运行方式</Label>
              <Select v-model="runtimeModeModel">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue placeholder="全部方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="userscript">用户脚本</SelectItem>
                  <SelectItem value="extension">浏览器扩展</SelectItem>
                  <SelectItem value="bookmarklet">书签脚本</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">兼容设备</Label>
              <Select v-model="deviceModel">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue placeholder="全部设备" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部设备</SelectItem>
                  <SelectItem value="desktop">桌面端</SelectItem>
                  <SelectItem value="mobile">移动端</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">可信徽章</Label>
              <Select v-model="badgeModel">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue placeholder="全部徽章" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部徽章</SelectItem>
                  <SelectItem value="official">官方插件</SelectItem>
                  <SelectItem value="recommended">推荐插件</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-normal text-muted-foreground">更新时间</Label>
              <Select v-model="updatedDaysModel">
                <SelectTrigger size="sm" class="w-full">
                  <SelectValue placeholder="不限时间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">不限时间</SelectItem>
                  <SelectItem value="7">最近 7 天</SelectItem>
                  <SelectItem value="30">最近 30 天</SelectItem>
                  <SelectItem value="90">最近 90 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col gap-2 pt-1">
              <Button size="sm" @click="applyFilters">应用筛选</Button>
              <Button v-if="hasFilters" variant="outline" size="sm" @click="resetFilters">清除筛选</Button>
            </div>
          </div>
        </div>
      </Card>

      <div class="min-w-0 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-baseline gap-2">
            <h2 class="text-lg font-semibold text-foreground">{{ activeTagName }}</h2>
            <span v-if="!loading" class="text-xs text-muted-foreground">{{ total }} 个插件</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">排序</span>
            <Select v-model="sortMode" @update:model-value="applySort">
              <SelectTrigger size="sm" class="w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smart">智能排序</SelectItem>
                <SelectItem value="latest">最近更新</SelectItem>
                <SelectItem value="usage">近期使用最多</SelectItem>
                <SelectItem value="verified">最近验证</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="loading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="space-y-2.5 rounded-xl border border-border bg-card p-4">
            <Skeleton class="h-5 w-2/5" />
            <Skeleton class="h-4 w-4/5" />
            <Skeleton class="h-3 w-3/5" />
          </div>
        </div>

        <Card v-else-if="errorText" class="gap-0 py-12 text-center">
          <p class="text-sm text-destructive">{{ errorText }}</p>
        </Card>

        <div v-else-if="rows.length" class="space-y-2.5">
          <article
            v-for="row in rows"
            :key="row.article_id"
            class="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <NuxtLink
                :to="`/plugin/${row.article_id}`"
                class="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary"
              >
                {{ row.article_title }}
              </NuxtLink>
              <PluginRequestLevelBadge :level="row.final_request_level" compact />
            </div>

            <p v-if="row.summary" class="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {{ displaySummary(row.summary) }}
            </p>

            <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span class="flex min-w-0 items-center gap-2.5">
                <span v-if="row.article_author" class="flex min-w-0 items-center gap-1.5">
                  <UserAvatar :user="row.article_author" size="md" />
                  <LuoguUserName
                    :user="row.article_author"
                    show-badge
                    truncate
                    class="max-w-[9rem]"
                  />
                </span>
                <span class="inline-flex shrink-0 items-center gap-1">
                  <Tag class="size-3" />
                  {{ runtimeMode(row.runtime_mode) }}
                </span>
              </span>
              <span class="flex shrink-0 items-center gap-2 tabular-nums">
                <span>{{ format(row.updated_at, 'YYYY-MM-DD') }}</span>
                <span aria-hidden="true" class="text-border">·</span>
                <span>30 天 {{ row.usage_30d || 0 }} 次</span>
              </span>
            </div>

            <footer class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-if="row.is_official"
                  class="h-5 border-transparent bg-[var(--lg-blue)]/12 px-1.5 font-normal text-[var(--lg-blue)]"
                >
                  官方
                </Badge>
                <Badge
                  v-if="row.is_recommended"
                  class="h-5 border-transparent bg-[var(--lg-yellow)]/20 px-1.5 font-normal text-[#8a6d00] dark:text-[var(--lg-yellow)]"
                >
                  推荐
                </Badge>
                <Badge v-for="tag in row.tags" :key="tag.id" variant="outline" class="h-5 px-1.5 font-normal">
                  {{ tag.name }}
                </Badge>
              </div>
              <NuxtLink
                :to="`/plugin/${row.article_id}`"
                class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                查看插件
                <ArrowRight class="size-3" />
              </NuxtLink>
            </footer>
          </article>
        </div>

        <Card v-else class="gap-0 border-dashed py-14 text-center">
          <p class="text-sm text-muted-foreground">没有符合条件的插件</p>
        </Card>

        <Pagination
          v-if="totalPages > 1"
          v-slot="{ page: current }"
          :page="page"
          :total="total"
          :items-per-page="PAGE_SIZE"
          :sibling-count="1"
          show-edges
          @update:page="goPage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious aria-label="上一页" />
            <template v-for="(item, index) in items">
              <PaginationItem
                v-if="item.type === 'page'"
                :key="`p-${item.value}`"
                :value="item.value"
                :is-active="item.value === current"
                :aria-label="`第 ${item.value} 页`"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :key="`e-${index}`" :index="index" />
            </template>
            <PaginationNext aria-label="下一页" />
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  </div>
</template>
