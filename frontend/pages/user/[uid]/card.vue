<script setup lang="ts">
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
} from '@lucide/vue'

type CardKind = 'activity' | 'random'

const route = useRoute()
const api = useApi()
const uid = String(route.params.uid || '')
const selected = ref<CardKind>('activity')
const copied = ref<'link' | 'markdown' | null>(null)
const imageNonce = ref(Date.now())

interface UserProfile {
  uid: number
  name: string
  avatar: string | null
  badge: string | null
  color: string
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
  name_hidden: boolean
}

const { data: profile, pending, error } = useLazyAsyncData(
  `user-card-${uid}`,
  () => api<UserProfile>(`/user/${uid}`),
  { server: false },
)

const pageTitle = computed(() => {
  const name = profile.value?.name_hidden ? `UID ${profile.value.uid}` : profile.value?.name
  return name ? `${name} 的图卡` : '图卡预览'
})

useHead(() => ({ title: `${pageTitle.value.replace(' 的图卡', ' 图卡')} - 洛谷档案馆` }))

const cardPath = computed(() => `/api/v1/image/feed/${selected.value}/${uid}.svg`)
const imageUrl = computed(() => {
  if (!import.meta.client) return cardPath.value
  return `${window.location.origin}${cardPath.value}`
})
const previewSrc = computed(() => `${cardPath.value}?t=${imageNonce.value}`)
const markdown = computed(() => {
  // 嵌入用 Markdown 保持最短格式，避免把用户名和图卡类型带到正文里。
  return `![](${imageUrl.value})`
})

const cardKinds: Array<{ key: CardKind; label: string }> = [
  { key: 'activity', label: '活跃统计' },
  { key: 'random', label: '随机语录' },
]

const imageLoaded = ref(false)
watch([selected, previewSrc], () => { imageLoaded.value = false })

async function copyText(kind: 'link' | 'markdown') {
  const text = kind === 'link' ? imageUrl.value : markdown.value
  await navigator.clipboard.writeText(text)
  copied.value = kind
  setTimeout(() => { copied.value = null }, 1400)
}

function refreshPreview() {
  imageNonce.value = Date.now()
}
</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div class="min-w-0">
        <NuxtLink
          :to="`/user/${uid}`"
          class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft class="size-3.5" />
          用户主页
        </NuxtLink>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">预览 SVG 图卡，并复制可嵌入链接。</p>
      </div>
      <Button variant="outline" size="sm" @click="refreshPreview">
        <RefreshCw class="size-3.5" />
        刷新预览
      </Button>
    </header>

    <!-- 首屏骨架 -->
    <div v-if="pending" class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card class="py-6">
        <CardContent class="flex min-h-[420px] items-center justify-center">
          <Skeleton class="h-64 w-full max-w-[540px] rounded-xl" />
        </CardContent>
      </Card>
      <div class="space-y-5">
        <Card class="gap-3 py-5">
          <CardHeader class="px-5"><Skeleton class="h-4 w-16" /></CardHeader>
          <CardContent class="px-5"><Skeleton class="h-9 w-full rounded-md" /></CardContent>
        </Card>
        <Card class="gap-3 py-5">
          <CardHeader class="px-5"><Skeleton class="h-4 w-16" /></CardHeader>
          <CardContent class="space-y-2 px-5">
            <Skeleton class="h-9 w-full rounded-md" />
            <Skeleton class="h-9 w-full rounded-md" />
            <Skeleton class="h-20 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="mt-5 rounded-xl border border-dashed border-border p-10 text-center">
      <p class="text-sm font-medium text-foreground">{{ error.data?.message || '用户未收录' }}</p>
      <p class="mt-1 text-sm text-muted-foreground">稍后刷新页面即可重试。</p>
    </div>

    <div v-else class="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <!-- 预览区：棋盘格背景衬托透明 SVG -->
      <Card class="py-6">
        <CardContent class="relative flex min-h-[420px] items-center justify-center">
          <Skeleton
            v-if="!imageLoaded"
            class="absolute inset-6 rounded-xl"
          />
          <div
            class="w-full rounded-lg p-6"
            :class="selected === 'random' ? 'max-w-[900px]' : ''"
            :style="{
              backgroundImage: 'linear-gradient(45deg, hsl(from var(--muted-foreground) h s l / 0.08) 25%, transparent 25%), linear-gradient(-45deg, hsl(from var(--muted-foreground) h s l / 0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(from var(--muted-foreground) h s l / 0.08) 75%), linear-gradient(-45deg, transparent 75%, hsl(from var(--muted-foreground) h s l / 0.08) 75%)',
              backgroundSize: '22px 22px',
              backgroundPosition: '0 0, 0 11px, 11px -11px, -11px 0',
            }"
          >
            <img
              :src="previewSrc"
              :alt="selected === 'activity' ? '活跃统计图卡预览' : '随机语录图卡预览'"
              class="block h-auto w-full object-contain transition-opacity duration-200"
              :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
              @load="imageLoaded = true"
            >
          </div>
        </CardContent>
      </Card>

      <!-- 侧栏 -->
      <div class="space-y-5">
        <Card class="gap-4 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-sm">图卡类型</CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <Tabs
              :model-value="selected"
              class="w-full"
              @update:model-value="selected = $event as CardKind; refreshPreview()"
            >
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger
                  v-for="item in cardKinds"
                  :key="item.key"
                  :value="item.key"
                >{{ item.label }}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card class="gap-4 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-sm">嵌入链接</CardTitle>
            <CardDescription class="text-xs">Markdown 保持最短格式。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3 px-5">
            <div class="flex gap-2">
              <Input
                :model-value="imageUrl"
                readonly
                class="h-9 font-mono text-xs"
                spellcheck="false"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-9 shrink-0 gap-1.5 px-2.5"
                @click="copyText('link')"
              >
                <Copy class="size-3.5" />
                {{ copied === 'link' ? '已复制' : '复制' }}
              </Button>
            </div>
            <div class="relative">
              <Textarea
                :model-value="markdown"
                readonly
                rows="3"
                class="resize-none font-mono text-xs"
                spellcheck="false"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5"
              @click="copyText('markdown')"
            >
              <Copy class="size-3.5" />
              {{ copied === 'markdown' ? '已复制 Markdown' : '复制 Markdown' }}
            </Button>
          </CardContent>
          <CardFooter class="px-5">
            <Button variant="ghost" size="sm" as-child class="-mx-1 w-full gap-1.5">
              <a :href="cardPath" target="_blank" rel="noopener noreferrer">
                <ExternalLink class="size-3.5" />
                打开图片
                <ChevronRight class="size-3.5" />
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </div>
</template>
