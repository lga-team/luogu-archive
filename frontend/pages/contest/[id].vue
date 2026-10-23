<script setup lang="ts">
import { Search } from '@lucide/vue'

const api = useApi()
const { format } = useTime()
const route = useRoute()
const contestId = computed(() => Number(route.params.id))
// 洛谷比赛接口中 method=2 表示 ICPC 赛制。
const ICPC_CONTEST_METHOD = 2
const page = ref(1)
const keyword = ref('')
const appliedKeyword = ref('')
const openWarningUid = ref<number | null>(null)

interface ContestProblem {
  pid: string
  label: string
  title: string
}

interface ScoreDetail {
  score?: number
  runningTime?: number
}

interface ScoreboardUser {
  uid: number
  name: string
  color: string
  avatar: string | null
  badge: string | null
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
}

interface ScoreboardSquad {
  name: string
  members: ScoreboardUser[]
}

interface ScoreboardRow {
  uid: number
  name: string
  color: string
  avatar: string | null
  badge: string | null
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
  squad: ScoreboardSquad | null
  rank: number
  score: number
  running_time: number
  penalized: boolean
  problem_details: Record<string, ScoreDetail>
  rating: number | null
  delta: number | null
  rating_pending: boolean
  warnings: string[]
}

interface ScoreboardResponse {
  contest: {
    id: number
    name: string
    start_time: string
    end_time: string
    problem_count: number
    participant_count: number
    rated: boolean
    method: number | null
    rating_mode: 'loading' | 'prediction' | 'official' | 'unrated'
    status: string
  }
  problems: ContestProblem[]
  items: ScoreboardRow[]
  total: number
  page: number
  page_size: number
}

const { data, pending, error, refresh } = useLazyAsyncData(
  `contest-${contestId.value}`,
  () => api<ScoreboardResponse>(`/contest/${contestId.value}`, {
    query: { page: page.value, page_size: 50, q: appliedKeyword.value || undefined },
  }),
  { server: false, watch: [contestId, page, appliedKeyword] },
)

useHead(() => ({ title: data.value ? `${data.value.contest.name} - 洛谷档案馆` : '比赛 - 洛谷档案馆' }))

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / 50)))
const ratingTitle = computed(() =>
  data.value?.contest.rating_mode === 'official' ? '等级分结果' : '等级分预估',
)

function search() {
  page.value = 1
  const next = keyword.value.trim()
  if (next === appliedKeyword.value) refresh()
  else appliedKeyword.value = next
}

function formatDuration(duration: number | undefined | null) {
  if (duration === undefined || duration === null) return '-'
  // 洛谷 ICPC 榜单的总罚时和单题罚时均以秒为单位，其他赛制使用毫秒。
  const seconds = data.value?.contest.method === ICPC_CONTEST_METHOD
    ? duration
    : duration / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes.toFixed(2)}min`
  return `${(minutes / 60).toFixed(2)}h`
}

function formatScore(value: number | undefined) {
  if (value === undefined || value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function problemScoreClass(value: number | undefined) {
  if (value === undefined || value === null) return ''

  if (data.value?.contest.method === ICPC_CONTEST_METHOD) {
    return value >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'
  }

  return value > 0 ? 'text-[var(--success)]' : ''
}

function toggleWarning(uid: number) {
  openWarningUid.value = openWarningUid.value === uid ? null : uid
}

function userBrief(row: ScoreboardRow) {
  return {
    uid: row.uid,
    name: row.name,
    color: row.color,
    avatar: row.avatar,
    badge: row.badge,
    ccf_level: row.ccf_level,
    xcpc_level: row.xcpc_level,
    is_admin: row.is_admin,
  }
}
</script>

<template>
  <div @click="openWarningUid = null">
    <!-- 首屏骨架 -->
    <div v-if="pending && !data">
      <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-4">
        <div class="min-w-0">
          <Skeleton class="h-3.5 w-14" />
          <Skeleton class="mt-2.5 h-8 w-72" />
          <Skeleton class="mt-2 h-4 w-64" />
        </div>
        <div class="flex gap-8">
          <div><Skeleton class="h-3 w-8" /><Skeleton class="mt-1.5 h-6 w-8" /></div>
          <div><Skeleton class="h-3 w-14" /><Skeleton class="mt-1.5 h-6 w-10" /></div>
        </div>
      </div>
      <Card class="mt-5 gap-0 overflow-hidden py-0">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton class="h-4 w-16" />
          <Skeleton class="h-9 w-64 rounded-md" />
        </div>
        <div v-for="i in 8" :key="i" class="flex items-center gap-6 border-b border-border px-4 py-4 last:border-b-0">
          <Skeleton class="h-4 w-10" />
          <Skeleton class="h-4 w-36" />
          <Skeleton class="ml-auto h-3.5 w-16" />
          <Skeleton v-for="j in 5" :key="j" class="h-3.5 w-12" />
        </div>
      </Card>
    </div>

    <template v-else-if="data">
      <!-- 页面头：裸排 + border-b -->
      <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-4">
        <div class="min-w-0">
          <NuxtLink
            to="/contest"
            class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >比赛 /</NuxtLink>
          <h1 class="mt-1.5 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{{ data.contest.name }}</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ format(data.contest.start_time) }} 至 {{ format(data.contest.end_time) }}</p>
        </div>
        <dl class="flex gap-8">
          <div>
            <dt class="text-xs text-muted-foreground">题数</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums">{{ data.contest.problem_count }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">参赛人数</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums">{{ data.contest.participant_count }}</dd>
          </div>
        </dl>
      </header>

      <!-- 排行榜 -->
      <Card class="mt-5 gap-0 overflow-hidden py-0">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div class="flex items-baseline gap-2.5">
            <h2 class="text-base font-semibold tracking-tight">排行榜</h2>
            <span v-if="data.contest.rating_mode === 'loading'" class="text-xs text-muted-foreground">loading……</span>
            <span
              v-else
              class="text-xs font-medium"
              :class="data.contest.rating_mode === 'unrated' ? 'text-muted-foreground' : 'text-[var(--success)]'"
            >{{ data.contest.status }}</span>
          </div>
          <form class="flex gap-2" @submit.prevent="search">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="keyword"
                placeholder="用户名或 UID"
                aria-label="搜索参赛者"
                class="h-9 w-52 pl-8"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" class="h-9">搜索</Button>
          </form>
        </div>

        <div class="scoreboard-scroll overflow-x-auto">
          <table class="scoreboard-table w-full border-collapse">
            <thead>
              <tr>
                <th class="sticky-col sticky-rank text-muted-foreground">名次</th>
                <th class="sticky-col sticky-user text-left text-muted-foreground">参赛者</th>
                <th v-if="data.contest.rated" class="sticky-col sticky-rating text-muted-foreground">{{ ratingTitle }}</th>
                <th class="text-muted-foreground">总分</th>
                <th v-for="problem in data.problems" :key="problem.pid" class="text-muted-foreground">
                  <span class="problem-tip" tabindex="0" :title="`${problem.pid} ${problem.title}`">
                    {{ problem.label }}
                    <span class="pop">{{ problem.pid }} {{ problem.title }}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.items" :key="row.uid" :class="{ 'opacity-70': row.penalized }">
                <td class="sticky-col sticky-rank tabular-nums text-muted-foreground">
                  {{ row.penalized ? '-' : `#${row.rank}` }}
                </td>
                <td class="sticky-col sticky-user text-left">
                  <div v-if="row.squad" class="flex flex-col items-start gap-0.5">
                    <span class="max-w-full truncate text-xs text-muted-foreground">{{ row.squad.name }}</span>
                    <div class="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <LuoguUserName
                        v-for="member in row.squad.members"
                        :key="member.uid"
                        :user="member"
                        show-badge
                      />
                    </div>
                  </div>
                  <LuoguUserName v-else :user="userBrief(row)" show-badge />
                </td>
                <td v-if="data.contest.rated" class="sticky-col sticky-rating">
                  <span v-if="row.rating_pending" class="text-muted-foreground">loading……</span>
                  <span v-else-if="row.rating !== null" class="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                    {{ row.rating }}
                    <span v-if="(row.delta || 0) > 0" class="text-[13px] font-medium text-[var(--success)]">↑{{ row.delta }}</span>
                    <span v-else-if="(row.delta || 0) < 0" class="text-[13px] font-medium text-[var(--destructive)]">↓{{ Math.abs(row.delta || 0) }}</span>
                    <span v-else class="text-[13px] text-muted-foreground">0</span>
                  </span>
                  <span v-else class="text-muted-foreground">-</span>
                  <span
                    v-if="row.warnings.length"
                    class="warning-wrap"
                    :class="{ active: openWarningUid === row.uid }"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="warning-button"
                      aria-label="查看等级分说明"
                      @click="toggleWarning(row.uid)"
                    >!</button>
                    <span class="pop warning-pop">
                      <span v-for="reason in row.warnings" :key="reason">{{ reason }}</span>
                    </span>
                  </span>
                </td>
                <td class="score-cell tabular-nums">
                  <strong>{{ row.penalized ? '-' : formatScore(row.score) }}</strong>
                  <small v-if="!row.penalized">{{ formatDuration(row.running_time) }}</small>
                </td>
                <td v-for="problem in data.problems" :key="problem.pid" class="score-cell tabular-nums">
                  <template v-if="row.problem_details[problem.pid]">
                    <strong :class="problemScoreClass(row.problem_details[problem.pid].score)">
                      {{ formatScore(row.problem_details[problem.pid].score) }}
                    </strong>
                    <small>{{ formatDuration(row.problem_details[problem.pid].runningTime) }}</small>
                  </template>
                  <span v-else class="text-muted-foreground">-</span>
                </td>
              </tr>
              <tr v-if="!data.items.length">
                <td
                  :colspan="3 + data.problems.length + (data.contest.rated ? 1 : 0)"
                  class="py-12 text-center text-sm text-muted-foreground"
                >没有找到参赛者</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-if="totalPages > 1"
          v-slot="{ page: current }"
          class="border-t border-border py-3.5"
          :page="page"
          :total="data?.total || 0"
          :items-per-page="50"
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
      </Card>
    </template>

    <NotArchivedNotice
      v-else-if="error"
      title="比赛不存在或尚未完成归档"
      @retry="refresh()"
    />
  </div>
</template>

<style scoped>
/* 粘性列与悬浮提示：交互机制特殊，保留少量 scoped CSS */
.scoreboard-table { min-width: max-content; }
.scoreboard-table th,
.scoreboard-table td {
  height: 64px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  text-align: center;
  white-space: nowrap;
  font-size: 14px;
}
.scoreboard-table thead th { height: 50px; font-size: 13px; font-weight: 500; background: var(--card); }
.scoreboard-table tbody tr:last-child td { border-bottom: 0; }
.scoreboard-table tbody tr:hover td { background: var(--accent); }
.sticky-col { position: sticky; z-index: 2; background: var(--card); }
.sticky-rank { left: 0; width: 76px; min-width: 76px; }
.sticky-user { left: 76px; width: 300px; min-width: 300px; }
.sticky-rating { left: 376px; width: 150px; min-width: 150px; box-shadow: 7px 0 10px -10px rgba(0, 0, 0, .7); }
thead .sticky-col { z-index: 4; }

.score-cell strong, .score-cell small { display: block; }
.score-cell small { margin-top: 1px; color: var(--muted-foreground); font-size: 11px; font-weight: 400; }

/* 提示浮层 */
.problem-tip { position: relative; display: inline-flex; justify-content: center; min-width: 30px; cursor: help; }
.pop {
  position: absolute; z-index: 30; top: calc(100% + 9px); left: 50%; transform: translateX(-50%);
  display: none; min-width: 160px; max-width: 280px; padding: 8px 10px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--popover, var(--card)); color: var(--foreground);
  box-shadow: 0 8px 22px rgba(0,0,0,.16); white-space: normal; text-align: left;
  font-size: 12px; line-height: 1.55;
}
.problem-tip:hover .pop, .problem-tip:focus .pop { display: block; }
.warning-wrap { position: relative; display: inline-flex; margin-left: 5px; vertical-align: middle; }
.warning-button {
  width: 18px; height: 18px; padding: 0; border: 1px solid var(--warning); border-radius: 50%;
  background: transparent; color: var(--warning); font-size: 12px; font-weight: 700; cursor: help;
}
.warning-pop { left: auto; right: -8px; transform: none; min-width: 220px; }
.warning-pop span { display: block; }
.warning-pop span + span { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--border); }
.warning-wrap:hover .warning-pop, .warning-wrap.active .warning-pop { display: block; }
/* 表格后面的行会晚于前面的行绘制，提示出现时把整行提升为独立层级。 */
tbody tr:has(.warning-wrap:hover),
tbody tr:has(.warning-wrap.active) { position: relative; z-index: 20; }
tbody tr:has(.warning-wrap:hover) .sticky-rating,
tbody tr:has(.warning-wrap.active) .sticky-rating { z-index: 30; }
/* 末尾两行向上展开，避免提示框被面板底边裁切。 */
tbody tr:nth-last-child(-n + 2) .warning-pop { top: auto; bottom: calc(100% + 9px); }

@media (max-width: 768px) {
  .sticky-rank { left: 0; width: 42px; min-width: 42px; }
  .sticky-user { left: 42px; width: 180px; min-width: 180px; }
  .sticky-rating { left: 222px; width: 110px; min-width: 110px; }
  .warning-pop { position: fixed; top: auto; left: 50%; right: auto; bottom: 24px; transform: translateX(-50%); width: min(280px, calc(100vw - 40px)); }
}
</style>
