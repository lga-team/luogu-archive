<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const api = useApi()

interface VersionEntry {
  id: number
  title: string | null
  content_md: string
  content_hash: string
  crawled_at: string
  is_current: boolean
}

interface ArticleHistoryResp {
  article_id: string
  title: string
  versions: VersionEntry[]
}

const { data, error, pending } = useLazyAsyncData(`article-history-${id}`, () =>
  api<ArticleHistoryResp>(`/article/${id}/history`),
  { server: false },
)
useHead(() => ({ title: data.value ? `${data.value.title} 历史版本 - 洛谷档案馆` : '历史版本 - 洛谷档案馆' }))

</script>

<template>
  <div class="mx-auto w-full max-w-3xl">
    <div v-if="pending" class="space-y-3 py-2">
      <Skeleton class="h-6 w-48" />
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-xl" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-dashed border-border p-10 text-center">
      <p class="text-sm font-medium text-foreground">{{ error.data?.message || '加载失败' }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="navigateTo(`/article/${id}`)">返回文章</Button>
    </div>

    <div v-else-if="data" class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div class="min-w-0">
          <h1 class="truncate text-xl font-semibold tracking-tight">{{ data.title }} 的历史版本</h1>
          <p class="mt-1 text-sm text-muted-foreground">按抓取时间分组，展示相邻版本的正文差异</p>
        </div>
        <Button variant="outline" size="sm" @click="navigateTo(`/article/${id}`)">返回文章</Button>
      </header>

      <VersionHistoryTimeline :versions="data.versions" empty-text="暂无文章历史版本" />
    </div>
  </div>
</template>
