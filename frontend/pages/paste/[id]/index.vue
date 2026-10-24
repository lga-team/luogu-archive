<script setup lang="ts">
definePageMeta({ pageWidth: 'wide' })

import { Check, ChevronDown, Clock3, Copy, ExternalLink, History } from '@lucide/vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'

const { format, smart } = useTime()

const route = useRoute()
const api = useApi()
const id = route.params.id as string

interface PasteDetail {
  paste_id: string
  content_md: string
  author: any
  crawled_at: string
  version_count: number
}

interface VersionEntry {
  id: number
  title: string | null
  content_md: string
  crawled_at: string
  is_current: boolean
}

// 不阻塞页面首屏：剪贴板正文由浏览器端异步请求。
const { data, error, pending, refresh } = useLazyAsyncData(`paste-${id}`, () =>
  api<PasteDetail>(`/paste/${id}`),
  { server: false },
)

const {
  data: history,
  error: historyError,
  pending: historyPending,
  refresh: refreshHistory,
} = useLazyAsyncData(`paste-history-${id}`, () =>
  api<{ versions: VersionEntry[] }>(`/paste/${id}/history`),
  { server: false },
)

const versions = computed(() => history.value?.versions || [])
// 选中态存 id 而非对象引用：接口重取后数组是新的，引用比较会失配
const selectedId = ref<number | null>(null)
watchEffect(() => {
  if (selectedId.value === null && versions.value.length) {
    selectedId.value = (versions.value.find(v => v.is_current) || versions.value[0]).id
  }
})
const selected = computed(() => versions.value.find(v => v.id === selectedId.value) ?? null)
function selectVersion(version: VersionEntry) {
  selectedId.value = version.id
}

// 正文接口与版本接口不保证同时成功（首次 404 时两者都失败，重查后正文可能先回来），
// 优先用选中的版本，版本列表还没回来时退回详情接口自带的正文。
const activeContent = computed(() => selected.value?.content_md ?? data.value?.content_md ?? '')

const { render } = useMarkdown()
const html = computed(() => render(activeContent.value))

// 重新加载要把两个接口一起重查，否则正文回来了、版本列表还停在失败态。
async function reload() {
  await Promise.all([refresh(), refreshHistory()])
}

const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

// 版本列表在桌面端默认展开，移动端收起（与文章页一致）。
const historyOpen = ref(true)
let media: MediaQueryList | undefined
onMounted(() => {
  media = window.matchMedia('(max-width: 1023px)')
  historyOpen.value = !media.matches
  media.addEventListener('change', onMediaChange)
})
function onMediaChange() {
  historyOpen.value = !media?.matches
}
onBeforeUnmount(() => media?.removeEventListener('change', onMediaChange))

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
async function copyOriginal() {
  if (!activeContent.value) return
  clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(activeContent.value)
    copied.value = true
    copyTimer = setTimeout(() => { copied.value = false }, 1600)
  } catch {}
}
onBeforeUnmount(() => clearTimeout(copyTimer))
useHead(() => ({ title: data.value ? `${data.value.author?.name ?? '未知用户'} 的剪贴板 - 洛谷档案馆` : '剪贴板 - 洛谷档案馆' }))

</script>

<template>
  <div class="mx-auto w-full">
    <div v-if="pending" class="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px] lg:gap-8">
      <!-- 左：历史版本 -->
      <aside class="min-w-0 lg:col-start-1 lg:row-span-2">
        <div class="sticky top-4">
          <div class="flex items-center gap-2 border-b border-border pb-3">
            <Skeleton class="size-4 rounded-sm" />
            <Skeleton class="h-4 w-16" />
          </div>
          <div class="space-y-4 pt-4">
            <div v-for="i in 5" :key="i" class="relative pl-[22px]">
              <Skeleton class="absolute left-0 top-1 size-3 rounded-full" />
              <Skeleton class="h-3.5 w-16" />
              <Skeleton class="mt-1.5 h-3 w-28" />
            </div>
          </div>
        </div>
      </aside>

      <!-- 中：标签 + 标题 + meta + 操作 + 正文 -->
      <div class="min-w-0 lg:col-start-2 lg:row-span-2">
        <Skeleton class="h-3 w-20" />
        <div class="mt-3 flex items-center gap-2">
          <Skeleton class="h-8 w-20" />
          <Skeleton class="h-7 w-24" />
        </div>
        <div class="mt-4 flex items-center gap-3">
          <Skeleton class="size-8 rounded-full" />
          <Skeleton class="h-4 w-28" />
          <Skeleton class="h-3 w-24" />
        </div>
        <div class="mt-4 flex items-center gap-2 border-b border-border pb-6">
          <Skeleton class="h-8 w-24 rounded-md" />
          <Skeleton class="h-8 w-24 rounded-md" />
          <Skeleton class="h-8 w-20 rounded-md" />
        </div>
        <div class="mt-6 space-y-2.5">
          <Skeleton v-for="i in 10" :key="i" class="h-4" :class="i % 4 === 0 ? 'w-2/3' : 'w-full'" />
        </div>
      </div>

      <!-- 右：目录 -->
      <div class="hidden min-w-0 xl:col-start-3 xl:row-span-2 xl:block">
        <div class="sticky top-4">
          <Skeleton class="h-4 w-10" />
          <div class="mt-4 space-y-2.5">
            <Skeleton v-for="i in 6" :key="i" class="h-3" :class="i % 3 === 0 ? 'w-3/4' : 'w-full'" />
          </div>
        </div>
      </div>
    </div>

    <NotArchivedNotice
      v-else-if="error"
      :title="error.data?.message || '加载失败'"
      :description="error.statusCode === 404 ? '本站从未爬取过这条剪贴板，刚才已触发一次爬取，点击重新加载即可。' : null"
      @retry="reload()"
    />

    <div v-else-if="data" class="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px] lg:gap-8">
      <!-- 历史版本（左侧 sticky，点版本直接切换正文） -->
      <aside class="min-w-0 lg:col-start-1 lg:row-span-2">
        <div class="sticky top-4">
          <Collapsible v-model:open="historyOpen" class="group">
            <CollapsibleTrigger as-child>
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-2 border-b border-border pb-3 text-left"
              >
                <Clock3 class="size-4 text-muted-foreground" />
                <h2 class="flex-1 text-sm font-semibold tracking-tight">历史版本</h2>
                <ChevronDown class="size-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent class="pt-3">
              <div v-if="historyPending" class="space-y-4">
                <div v-for="i in 4" :key="i" class="relative pl-[22px]">
                  <Skeleton class="absolute left-0 top-1 size-3 rounded-full" />
                  <Skeleton class="h-3.5 w-16" />
                  <Skeleton class="mt-1.5 h-3 w-28" />
                </div>
              </div>
              <ol v-else-if="versions.length">
                <li
                  v-for="(version, index) in versions"
                  :key="version.id"
                  class="relative pl-[22px]"
                >
                  <span
                    v-if="index < versions.length - 1"
                    class="absolute bottom-[-6px] left-[6px] top-3 w-0.5 bg-border"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    class="relative grid w-full gap-0.5 pb-4 text-left text-[13px] leading-snug"
                    :aria-current="selected === version ? 'true' : undefined"
                    @click="selectVersion(version)"
                  >
                    <span
                      class="absolute left-[-22px] top-1 size-3 rounded-full border-2 bg-background"
                      :class="selected === version ? 'border-primary' : 'border-muted-foreground/60'"
                      aria-hidden="true"
                    />
                    <span class="flex items-center gap-1.5 font-medium" :class="selected === version ? 'text-primary' : 'text-foreground'">
                      版本 {{ versions.length - index }}
                      <span
                        v-if="version.is_current"
                        class="rounded-full border border-[var(--success)] px-1.5 py-px text-[10px] text-[var(--success)]"
                      >最新</span>
                    </span>
                    <time class="tabular-nums text-muted-foreground" :datetime="version.crawled_at">
                      {{ format(version.crawled_at, 'YYYY/M/D HH:mm:ss') }}
                    </time>
                  </button>
                </li>
              </ol>
              <p v-else-if="historyError" class="text-[13px] text-muted-foreground">历史版本加载失败</p>
              <p v-else class="text-[13px] text-muted-foreground">暂无历史版本</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </aside>

      <!-- 中栏：标题 + 操作行 + 正文，裸排 + border-b，正文直接沉底 -->
      <div class="min-w-0 lg:col-start-2 lg:row-span-2">
        <p class="text-xs font-medium tracking-wide text-muted-foreground">剪贴板归档</p>

        <h1 class="mt-2 text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
          <span>剪贴板</span>
          <span class="ml-2 font-mono text-xl font-semibold text-muted-foreground sm:text-2xl">{{ id }}</span>
        </h1>

        <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <NuxtLink
            v-if="data.author"
            :to="`/user/${data.author.uid}`"
            class="flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <UserAvatar :user="data.author" size="lg" />
            <LuoguUserName :user="data.author" show-badge truncate />
          </NuxtLink>
          <span v-else>作者未收录</span>

          <span class="text-xs">上次更新 · {{ smart(data.crawled_at) }}</span>

          <NuxtLink
            v-if="versions.length > 1"
            :to="`/paste/${id}/history`"
            class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <History class="size-3.5" />
            {{ versions.length }} 个历史版本
          </NuxtLink>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-6">
          <Button variant="outline" size="sm" as-child>
            <a :href="`https://www.luogu.com.cn/paste/${id}`" target="_blank" rel="noopener noreferrer">
              <ExternalLink class="size-3.5" />
              查看原文
            </a>
          </Button>
          <Button variant="outline" size="sm" @click="copyOriginal">
            <Check v-if="copied" class="size-3.5" />
            <Copy v-else class="size-3.5" />
            {{ copied ? '已复制' : '复制原文' }}
          </Button>
          <SaveButton content-type="paste" :content-id="id" />
        </div>

        <article ref="contentRef" class="lg-content mt-6 [&_h1,&_h2,&_h3,&_h4,&_h5,&_h6]:scroll-mt-6" v-html="html" />
        <p v-if="!activeContent" class="mt-4 text-[13px] text-muted-foreground">此版本正文为空</p>
      </div>

      <!-- 目录（右侧 sticky） -->
      <div class="hidden min-w-0 xl:col-start-3 xl:row-span-2 xl:block">
        <DocumentToc :content="contentRef" />
      </div>
    </div>
  </div>
</template>
