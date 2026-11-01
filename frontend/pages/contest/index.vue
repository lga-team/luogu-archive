<script setup lang="ts">
import { Puzzle, Search, Trophy } from 'lucide-vue-next'

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
interface ContestListResponse { items: ContestItem[]; total: number; page: number; page_size: number }

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
function statusClass(status: string) {
  if (status === '正式结果') return 'tag--success'
  if (status === '不计等级分') return 'tag--warn'
  return 'tag--info'
}
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="比赛"
      description="已结束比赛的排行榜、等级分结果与题目归档。"
      eyebrow="Contests"
    >
      <template #icon><Trophy :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" href="/plugin/438gx0rt">
          <template #start><Puzzle :size="16" aria-hidden="true" /></template>官方插件
        </FButton>
      </template>
    </PageHeader>

    <form class="contest-search card card__body" role="search" @submit.prevent="search">
      <div class="contest-search__field">
        <Search :size="18" class="contest-search__icon" aria-hidden="true" />
        <FInput v-model="keyword" placeholder="比赛名称或 ID" aria-label="搜索比赛" />
      </div>
      <FButton type="submit" appearance="primary">搜索</FButton>
    </form>

    <LoadingPanel v-if="pending && !data" variant="list" :rows="6" title="正在加载比赛" />

    <div v-else class="card">
      <EmptyState
        v-if="!data?.items.length"
        title="没有找到比赛"
        :description="appliedKeyword ? `没有与「${appliedKeyword}」匹配的比赛。` : '还没有已归档的比赛。'"
      />
      <div v-else class="table-wrap" style="border: 0; border-radius: 0">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">比赛</th>
              <th scope="col">结束时间</th>
              <th scope="col">题数</th>
              <th scope="col">参赛人数</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td>
                <NuxtLink :to="`/contest/${item.id}`" class="contest-name">{{ item.name }}</NuxtLink>
                <span class="contest-id">#{{ item.id }}</span>
              </td>
              <td class="nowrap">{{ format(item.end_time) }}</td>
              <td class="tabular">{{ item.problem_count }}</td>
              <td class="tabular">{{ item.participant_count }}</td>
              <td><span class="tag" :class="statusClass(item.status)">{{ item.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ArchivePagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" :pending="pending" @page="page = $event" />
  </div>
</template>

<style scoped>
.contest-search { display: flex; gap: 8px; align-items: center; padding: 12px; }
.contest-search__field { position: relative; flex: 1 1 auto; min-width: 0; display: flex; align-items: center; }
.contest-search__icon { position: absolute; left: 11px; z-index: 1; color: var(--colorNeutralForeground3); pointer-events: none; }
.contest-search__field :deep(fluent-text-input) { width: 100%; }
.contest-search__field :deep(fluent-text-input::part(root)) { padding-left: 36px; }
.contest-name { color: var(--colorNeutralForeground1); font-weight: 600; text-decoration: none; }
.contest-name:hover { color: var(--colorBrandForeground1); }
.contest-id { margin-left: 8px; color: var(--colorNeutralForeground3); font-size: 11px; font-family: var(--fontFamilyMonospace); }
@media (max-width: 680px) {
  .contest-search { flex-direction: column; align-items: stretch; }
}
</style>
