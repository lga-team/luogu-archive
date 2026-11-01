<script setup lang="ts">
import { BookOpenCheck, ExternalLink, RefreshCw } from 'lucide-vue-next'

const api = useApi()
const route = useRoute()
const { fromNow } = useTime()

interface ProblemItem { pid: string; title: string; difficulty: string | null; tags: Array<number | string>; solution_open: boolean }
interface ProblemDifficultyBucket { items: ProblemItem[]; total: number }

const PREVIEW_LIMIT = 20
const { data, pending: listPending } = useLazyAsyncData('problem-list', () =>
  api<Record<string, ProblemDifficultyBucket>>('/problem/list', { query: { preview_limit: PREVIEW_LIMIT } }),
  { server: false },
)
const { data: lastCrawled } = useLazyAsyncData('problem-list-last-crawled', () =>
  api<{ last_crawled_at: string | null }>('/last-crawled?type=problem_catalog'),
  { server: false },
)
const relTime = computed(() => lastCrawled.value?.last_crawled_at ? fromNow(lastCrawled.value.last_crawled_at) : '未知')

const diffOrder = ['入门', '普及-', '普及', '普及+/提高-', '提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS', '暂无评定']
const sortedKeys = computed(() => {
  if (!data.value) return []
  return Object.keys(data.value).sort((a, b) => {
    const ai = diffOrder.indexOf(a)
    const bi = diffOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
})

const diffColors: Record<string, string> = {
  '入门': '#FE4C61',
  '普及-': '#F39C11',
  '普及': '#FFC116',
  '普及/提高-': '#FFC116',
  '普及+/提高-': '#52C41A',
  '普及+/提高': '#52C41A',
  '提高': '#52C41A',
  '提高+/省选-': '#3498DB',
  '省选/NOI-': '#9D3DCF',
  'NOI/NOI+/CTS': '#0E1D69',
  'NOI/NOI+/CTSC': '#0E1D69',
  'unknown_8': '#0E1D69',
  '暂无评定': '#BFBFBF',
}
function diffColor(key: string) { return diffColors[key] || '#BFBFBF' }

const selectedDiff = computed<string | null>(() => {
  const d = route.query.difficulty
  return typeof d === 'string' && d.length > 0 ? d : null
})

const { data: fullList, pending: fullPending } = useLazyAsyncData(
  'problem-list-full',
  () => {
    if (!selectedDiff.value) return Promise.resolve<ProblemItem[]>([])
    return api<ProblemItem[]>('/problem/list/by-difficulty', { query: { difficulty: selectedDiff.value } })
  },
  { server: false, watch: [selectedDiff] },
)

const visibleKeys = computed(() => {
  if (selectedDiff.value) return sortedKeys.value.includes(selectedDiff.value) ? [selectedDiff.value] : []
  return sortedKeys.value
})
function previewFor(k: string): ProblemItem[] { return data.value?.[k]?.items || [] }
function totalFor(k: string): number { return data.value?.[k]?.total || 0 }
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="题目库"
      description="按洛谷难度分档归档题目，并记录题解是否开放。"
      eyebrow="Problems"
    >
      <template #icon><BookOpenCheck :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span class="meta-item">上次更新：{{ relTime }}</span>
        <a href="https://www.luogu.com.cn/problem/list" target="_blank" rel="noopener noreferrer" class="meta-item">
          <ExternalLink :size="13" aria-hidden="true" />查看洛谷原站
        </a>
      </template>
      <template #actions>
        <SaveButton content-type="problem" content-id="list">
          <template #default="{ state, message, save }">
            <FButton appearance="outline" :loading="state === 'pending'" @click="save">
              <template #start><RefreshCw v-if="state !== 'pending'" :size="15" aria-hidden="true" /></template>
              {{ state === 'idle' ? '更新题库' : message || '处理中…' }}
            </FButton>
          </template>
        </SaveButton>
      </template>
    </PageHeader>

    <div v-if="selectedDiff" class="notice notice--brand">
      <span>
        当前难度：<strong :style="{ color: diffColor(selectedDiff) }">{{ selectedDiff }}</strong>
        · <NuxtLink to="/problem/list">返回所有难度</NuxtLink>
      </span>
    </div>
    <p v-else class="field-help">
      每档显示前 {{ PREVIEW_LIMIT }} 道；点击「查看全部」浏览完整列表。题目链接会跳转到洛谷原站。
    </p>

    <LoadingPanel v-if="listPending && !data" variant="list" :rows="6" title="正在加载题目库" />

    <section v-else-if="selectedDiff" class="page-section">
      <div class="section-head">
        <div class="section-head__text">
          <h2 class="section-title" :style="{ color: diffColor(selectedDiff) }">{{ selectedDiff }}</h2>
          <span class="section-subtitle">{{ fullList?.length || 0 }} 道题目</span>
        </div>
      </div>
      <div class="card">
        <LoadingPanel v-if="fullPending" variant="list" :rows="5" title="正在加载题目" compact />
        <EmptyState v-else-if="!fullList?.length" title="该档暂无题目" />
        <div v-else class="problem-grid">
          <a
            v-for="p in fullList"
            :key="p.pid"
            :href="`https://www.luogu.com.cn/problem/${p.pid}`"
            target="_blank"
            rel="noopener noreferrer"
            class="problem-row"
          >
            <span class="problem-pid" :style="{ color: diffColor(selectedDiff) }">{{ p.pid }}</span>
            <span class="problem-title">{{ p.title }}</span>
            <ExternalLink :size="13" class="problem-open" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>

    <div v-else class="problem-sections">
      <section v-for="k in visibleKeys" :key="k" class="page-section">
        <div class="section-head">
          <div class="section-head__text" style="flex-direction: row; align-items: center; gap: 10px">
            <span class="diff-dot" :style="{ background: diffColor(k) }" />
            <h2 class="section-title" style="font-size: 18px">{{ k }}</h2>
            <span class="tag">{{ totalFor(k) }} 道</span>
          </div>
          <NuxtLink v-if="totalFor(k) > PREVIEW_LIMIT" :to="{ path: '/problem/list', query: { difficulty: k } }" class="section-actions">
            <FButton appearance="subtle" size="small">查看全部</FButton>
          </NuxtLink>
        </div>
        <div class="card">
          <div class="problem-grid">
            <a
              v-for="p in previewFor(k)"
              :key="p.pid"
              :href="`https://www.luogu.com.cn/problem/${p.pid}`"
              target="_blank"
              rel="noopener noreferrer"
              class="problem-row"
            >
              <span class="problem-pid" :style="{ color: diffColor(k) }">{{ p.pid }}</span>
              <span class="problem-title">{{ p.title }}</span>
              <ExternalLink :size="13" class="problem-open" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      <EmptyState v-if="!visibleKeys.length && !listPending" title="暂无题目数据" description="可以提交一次题库更新任务。" />
    </div>
  </div>
</template>

<style scoped>
.problem-sections { display: flex; flex-direction: column; gap: 22px; }
.diff-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.problem-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; padding: 8px; }
.problem-row {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 8px 10px; border-radius: var(--borderRadiusMedium);
  color: var(--colorNeutralForeground1); text-decoration: none;
  transition: background var(--app-transition);
}
.problem-row:hover { background: var(--colorNeutralBackground1Hover); text-decoration: none; }
.problem-pid { font-family: var(--fontFamilyMonospace); font-weight: 600; font-size: 12.5px; flex-shrink: 0; }
.problem-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.problem-open { color: var(--colorNeutralForeground4); flex-shrink: 0; opacity: 0; }
.problem-row:hover .problem-open { opacity: 1; }
@media (max-width: 760px) {
  .problem-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
