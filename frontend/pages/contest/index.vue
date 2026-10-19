<script setup lang="ts">
import { Search, Sparkles } from '@lucide/vue'

const api = useApi()
const { format } = useTime()
const page = ref(1)
const keyword = ref('')
const appliedKeyword = ref('')

interface ContestItem {
  id: number
  name: string
  start_time: string
  end_time: string
  problem_count: number
  participant_count: number
  rated: boolean
  status: string
}

interface ContestListResponse {
  items: ContestItem[]
  total: number
  page: number
  page_size: number
}

const { data, pending, refresh } = useLazyAsyncData(
  'contest-list',
  () => api<ContestListResponse>('/contests', {
    query: { page: page.value, page_size: 20, q: appliedKeyword.value || undefined },
  }),
  { server: false, watch: [page, appliedKeyword] },
)

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / 20)))

function search() {
  page.value = 1
  appliedKeyword.value = keyword.value.trim()
  if (appliedKeyword.value === keyword.value.trim()) refresh()
}

function statusCls(s: string) {
  if (s === '正式结果') return 'text-[var(--lg-green)]'
  if (s === '不计等级分') return 'text-muted-foreground'
  return 'text-[var(--lg-orange)]'
}

useHead({ title: '比赛 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-muted-foreground">已结束比赛的排行榜与等级分结果</p>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">比赛</h1>
      </div>
      <form class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" @submit.prevent="search">
        <div class="relative sm:w-60">
          <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="keyword"
            placeholder="比赛名称或 ID"
            aria-label="搜索比赛"
            class="h-9 pl-8"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" class="h-9">搜索</Button>
        <Button as-child size="sm" class="h-9 gap-1.5">
          <NuxtLink to="/plugin/438gx0rt">
            <Sparkles class="size-3.5" />
            官方插件
          </NuxtLink>
        </Button>
      </form>
    </header>

    <!-- 表格骨架 -->
    <div v-if="pending && !data" class="mt-5">
      <Card class="gap-0 overflow-hidden py-0">
        <div class="border-b border-border px-4 py-3">
          <Skeleton class="h-3.5 w-40" />
        </div>
        <div v-for="i in 8" :key="i" class="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
          <Skeleton class="h-4 w-48" />
          <Skeleton class="ml-auto h-3.5 w-28" />
          <Skeleton class="h-3.5 w-10" />
          <Skeleton class="h-3.5 w-14" />
          <Skeleton class="h-3.5 w-16" />
        </div>
      </Card>
    </div>

    <!-- 列表 -->
    <Card v-else class="mt-5 gap-0 overflow-hidden py-0">
      <div class="overflow-x-auto">
        <Table class="min-w-[720px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>比赛</TableHead>
              <TableHead>结束时间</TableHead>
              <TableHead class="w-16">题数</TableHead>
              <TableHead class="w-24">参赛人数</TableHead>
              <TableHead class="w-28">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in data?.items || []" :key="item.id">
              <TableCell class="min-w-0">
                <NuxtLink
                  :to="`/contest/${item.id}`"
                  class="font-semibold text-foreground transition-colors hover:text-primary"
                >{{ item.name }}</NuxtLink>
                <span class="ml-2 text-xs tabular-nums text-muted-foreground">#{{ item.id }}</span>
              </TableCell>
              <TableCell class="tabular-nums text-muted-foreground">{{ format(item.end_time) }}</TableCell>
              <TableCell class="tabular-nums">{{ item.problem_count }}</TableCell>
              <TableCell class="tabular-nums">{{ item.participant_count }}</TableCell>
              <TableCell>
                <span class="text-[13px] font-medium" :class="statusCls(item.status)">{{ item.status }}</span>
              </TableCell>
            </TableRow>
            <TableRow v-if="!data?.items.length">
              <TableCell colspan="5" class="py-12 text-center text-sm text-muted-foreground">
                没有找到比赛
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <!-- 分页 -->
    <Pagination
      v-if="totalPages > 1"
      v-slot="{ page: current }"
      class="mt-5"
      :page="page"
      :total="data?.total || 0"
      :items-per-page="20"
      :sibling-count="1"
      show-edges
      @update:page="(p: number) => (page = p)"
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
</template>
