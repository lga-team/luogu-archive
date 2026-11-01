<script setup lang="ts">
import { ArrowLeft, Award, Search, Trophy, TriangleAlert } from 'lucide-vue-next'

const api = useApi()
const { format } = useTime()
const route = useRoute()
const contestId = computed(() => Number(route.params.id))
const ICPC_CONTEST_METHOD = 2
const page = ref(1)
const keyword = ref('')
const appliedKeyword = ref('')
const openWarningUid = ref<number | null>(null)

interface ContestProblem { pid: string; label: string; title: string }
interface ScoreDetail { score?: number; runningTime?: number }
interface ScoreboardUser {
  uid: number; name: string; color: string; avatar: string | null; badge: string | null
  ccf_level: number; xcpc_level: number; is_admin: boolean
}
interface ScoreboardSquad { name: string; members: ScoreboardUser[] }
interface ScoreboardRow {
  uid: number; name: string; color: string; avatar: string | null; badge: string | null
  ccf_level: number; xcpc_level: number; is_admin: boolean
  squad: ScoreboardSquad | null
  rank: number; score: number; running_time: number; penalized: boolean
  problem_details: Record<string, ScoreDetail>
  rating: number | null; delta: number | null; rating_pending: boolean; warnings: string[]
}
interface ScoreboardResponse {
  contest: {
    id: number; name: string; start_time: string; end_time: string; problem_count: number
    participant_count: number; rated: boolean; method: number | null
    rating_mode: 'loading' | 'prediction' | 'official' | 'unrated'; status: string
  }
  problems: ContestProblem[]
  items: ScoreboardRow[]
  total: number; page: number; page_size: number
}

const { data, pending, error, refresh } = useLazyAsyncData(
  `contest-${contestId.value}`,
  () => api<ScoreboardResponse>(`/contest/${contestId.value}`, {
    query: { page: page.value, page_size: 50, q: appliedKeyword.value || undefined },
  }),
  { server: false, watch: [contestId, page, appliedKeyword] },
)

useHead(() => ({ title: data.value?.contest.name ? `${data.value.contest.name} - 洛谷档案馆` : '比赛 - 洛谷档案馆' }))

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / 50)))
const ratingTitle = computed(() => data.value?.contest.rating_mode === 'official' ? '等级分结果' : '等级分预估')

function search() {
  page.value = 1
  const next = keyword.value.trim()
  if (next === appliedKeyword.value) refresh()
  else appliedKeyword.value = next
}
function formatDuration(duration: number | undefined | null) {
  if (duration === undefined || duration === null) return '-'
  const seconds = data.value?.contest.method === ICPC_CONTEST_METHOD ? duration : duration / 1000
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
  if (value === undefined || value === null) return {}
  if (data.value?.contest.method === ICPC_CONTEST_METHOD) return { accepted: value >= 0, rejected: value < 0 }
  return { accepted: value > 0 }
}
function toggleWarning(uid: number) {
  openWarningUid.value = openWarningUid.value === uid ? null : uid
}
</script>

<template>
  <div class="page page--wide scoreboard-page" @click="openWarningUid = null">
    <LoadingPanel v-if="pending && !data" variant="detail" title="正在加载排行榜" />

    <div v-else-if="error" class="card card__body">
      <EmptyState title="比赛不存在或尚未完成归档" description="可以返回比赛列表选择其他比赛。">
        <template #actions><FButton appearance="outline" @click="navigateTo('/contest')">返回比赛列表</FButton></template>
      </EmptyState>
    </div>

    <template v-else-if="data">
      <PageHeader
        :title="data.contest.name"
        :description="`${format(data.contest.start_time)} 至 ${format(data.contest.end_time)}`"
        eyebrow="Contest"
      >
        <template #icon><Trophy :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
        <template #meta>
          <span class="tag" :class="data.contest.rated ? 'tag--brand' : 'tag'">{{ data.contest.status }}</span>
          <span class="meta-item">#{{ data.contest.id }}</span>
        </template>
        <template #actions>
          <FButton appearance="outline" @click="navigateTo('/contest')">
            <template #start><ArrowLeft :size="16" aria-hidden="true" /></template>比赛列表
          </FButton>
        </template>
      </PageHeader>

      <div class="contest-stats">
        <div class="stat-card"><div class="stat-card__value">{{ data.contest.problem_count }}</div><div class="stat-card__label">题目数</div></div>
        <div class="stat-card"><div class="stat-card__value">{{ data.contest.participant_count }}</div><div class="stat-card__label">参赛人数</div></div>
        <div class="stat-card"><div class="stat-card__value">{{ totalPages }}</div><div class="stat-card__label">榜单页数</div></div>
        <div class="stat-card">
          <div class="stat-card__value" style="font-size: 16px">{{ data.contest.rated ? ratingTitle : '不计等级分' }}</div>
          <div class="stat-card__label">计分方式</div>
        </div>
      </div>

      <section class="card scoreboard-panel">
        <div class="card__header">
          <div class="cluster">
            <h2 class="card__title" style="display:flex;align-items:center;gap:8px"><Award :size="18" aria-hidden="true" />排行榜</h2>
            <span v-if="data.contest.rating_mode === 'loading'" class="tag">等级分计算中…</span>
          </div>
          <form class="scoreboard-search" role="search" @submit.prevent="search">
            <div class="scoreboard-search__field">
              <Search :size="15" class="scoreboard-search__icon" aria-hidden="true" />
              <FInput v-model="keyword" placeholder="用户名或 UID" aria-label="搜索参赛者" />
            </div>
            <FButton type="submit" appearance="outline" size="small">搜索</FButton>
          </form>
        </div>

        <div class="scoreboard-scroll">
          <table class="scoreboard">
            <thead>
              <tr>
                <th class="rank-col sticky-rank">名次</th>
                <th class="user-col sticky-user">参赛者</th>
                <th v-if="data.contest.rated" class="rating-col sticky-rating">{{ ratingTitle }}</th>
                <th class="total-col">总分</th>
                <th v-for="problem in data.problems" :key="problem.pid" class="problem-col">
                  <span class="problem-tip" tabindex="0" :title="`${problem.pid} ${problem.title}`">
                    {{ problem.label }}
                    <span class="problem-popover">{{ problem.pid }} {{ problem.title }}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.items" :key="row.uid" :class="{ penalized: row.penalized }">
                <td class="rank-col sticky-rank">{{ row.penalized ? '-' : `#${row.rank}` }}</td>
                <td class="user-col sticky-user">
                  <div v-if="row.squad" class="squad-entry">
                    <strong class="squad-name">{{ row.squad.name }}</strong>
                    <div class="squad-members">
                      <LuoguUserName v-for="member in row.squad.members" :key="member.uid" :user="member" show-badge />
                    </div>
                  </div>
                  <LuoguUserName
                    v-else
                    :user="{ uid: row.uid, name: row.name, color: row.color, avatar: row.avatar, badge: row.badge, ccf_level: row.ccf_level, xcpc_level: row.xcpc_level, is_admin: row.is_admin }"
                    show-badge
                  />
                </td>
                <td v-if="data.contest.rated" class="rating-col sticky-rating">
                  <span v-if="row.rating_pending" class="muted">计算中…</span>
                  <span v-else-if="row.rating !== null" class="rating-value">
                    <span class="rating-number">{{ row.rating }}</span>
                    <span v-if="(row.delta || 0) > 0" class="delta up">↑{{ row.delta }}</span>
                    <span v-else-if="(row.delta || 0) < 0" class="delta down">↓{{ Math.abs(row.delta || 0) }}</span>
                    <span v-else class="delta same">0</span>
                  </span>
                  <span v-else class="muted">-</span>
                  <span v-if="row.warnings.length" class="warning-wrap" :class="{ active: openWarningUid === row.uid }" @click.stop>
                    <button type="button" class="warning-button" aria-label="查看等级分说明" :title="row.warnings.join('\n')" @click="toggleWarning(row.uid)">
                      <TriangleAlert :size="12" aria-hidden="true" />
                    </button>
                    <span class="warning-popover">
                      <span v-for="reason in row.warnings" :key="reason">{{ reason }}</span>
                    </span>
                  </span>
                </td>
                <td class="total-col score-cell">
                  <strong>{{ row.penalized ? '-' : formatScore(row.score) }}</strong>
                  <small v-if="!row.penalized">{{ formatDuration(row.running_time) }}</small>
                </td>
                <td v-for="problem in data.problems" :key="problem.pid" class="problem-col score-cell">
                  <template v-if="row.problem_details[problem.pid]">
                    <strong :class="problemScoreClass(row.problem_details[problem.pid].score)">{{ formatScore(row.problem_details[problem.pid].score) }}</strong>
                    <small>{{ formatDuration(row.problem_details[problem.pid].runningTime) }}</small>
                  </template>
                  <span v-else class="muted">-</span>
                </td>
              </tr>
              <tr v-if="!data.items.length">
                <td :colspan="4 + data.problems.length + (data.contest.rated ? 1 : 0)" class="empty-cell">
                  没有找到参赛者
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="scoreboard-foot">
          <ArchivePagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" :pending="pending" @page="page = $event" />
          <span v-else class="muted" style="font-size: 12px">共 {{ data.total }} 位参赛者</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.scoreboard-page { max-width: 1380px; }
.contest-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.scoreboard-panel { overflow: hidden; }
.scoreboard-search { display: flex; gap: 6px; align-items: center; }
.scoreboard-search__field { position: relative; display: flex; align-items: center; width: 220px; max-width: 100%; }
.scoreboard-search__icon { position: absolute; left: 9px; z-index: 1; color: var(--colorNeutralForeground3); pointer-events: none; }
.scoreboard-search__field :deep(fluent-text-input) { width: 100%; }
.scoreboard-search__field :deep(fluent-text-input::part(root)) { height: 30px; padding-left: 30px; }
.scoreboard-scroll { overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; }
.scoreboard { width: 100%; min-width: max-content; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.scoreboard th, .scoreboard td {
  height: 64px; box-sizing: border-box; padding: 8px 14px; border-bottom: 1px solid var(--colorNeutralStroke2);
  text-align: center; white-space: nowrap;
}
.scoreboard th { height: 46px; color: var(--colorNeutralForeground3); font-size: 12px; font-weight: 600; background: var(--colorNeutralBackground2); }
.scoreboard tbody tr:hover td { background: var(--colorNeutralBackground1Hover); }
.scoreboard tbody tr:last-child td { border-bottom: 0; }
.rank-col { width: 68px; min-width: 68px; color: var(--colorNeutralForeground3); font-variant-numeric: tabular-nums; }
.user-col { width: 300px; min-width: 300px; text-align: left; }
.squad-entry { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.squad-name { max-width: 100%; overflow: hidden; color: var(--colorNeutralForeground2); text-overflow: ellipsis; font-size: 12px; }
.squad-members { display: flex; align-items: center; flex-wrap: wrap; gap: 3px 6px; max-width: 100%; }
.rating-col { width: 150px; min-width: 150px; }
.total-col { width: 100px; min-width: 100px; }
.problem-col { width: 108px; min-width: 108px; }
.sticky-rank, .sticky-user, .sticky-rating { position: sticky; z-index: 2; background: var(--colorNeutralBackground1); }
.sticky-rank { left: 0; }
.sticky-user { left: 68px; }
.sticky-rating { left: 368px; box-shadow: 6px 0 10px -10px rgba(0,0,0,.7); }
.scoreboard thead .sticky-rank, .scoreboard thead .sticky-user, .scoreboard thead .sticky-rating { z-index: 4; background: var(--colorNeutralBackground2); }
.rating-value { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
.rating-number { color: var(--colorNeutralForeground1); }
.delta { font-size: 12px; }
.delta.up { color: var(--colorPaletteGreenForeground1, #0e700e); }
.delta.down { color: var(--colorPaletteRedForeground1, #b10e1c); }
.delta.same { color: var(--colorNeutralForeground3); }
.score-cell strong, .score-cell small { display: block; }
.score-cell small { margin-top: 1px; color: var(--colorNeutralForeground3); font-size: 10.5px; font-weight: 400; }
.score-cell .accepted { color: var(--colorPaletteGreenForeground1, #0e700e); }
.score-cell .rejected { color: var(--colorPaletteRedForeground1, #b10e1c); }
.penalized { opacity: .7; }
.problem-tip { position: relative; display: inline-flex; justify-content: center; min-width: 26px; cursor: help; }
.problem-popover, .warning-popover {
  position: absolute; z-index: 30; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  display: none; min-width: 160px; max-width: 280px; padding: 8px 10px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusMedium);
  background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);
  box-shadow: var(--shadow16); white-space: normal; text-align: left; font-size: 12px; line-height: 1.55;
}
.problem-tip:hover .problem-popover, .problem-tip:focus .problem-popover { display: block; }
.warning-wrap { position: relative; display: inline-flex; margin-left: 4px; vertical-align: middle; }
.warning-button {
  display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0;
  border: 1px solid var(--colorPaletteDarkOrangeForeground1, #8a3707); border-radius: 50%;
  background: transparent; color: var(--colorPaletteDarkOrangeForeground1, #8a3707); cursor: help;
}
.warning-popover { left: auto; right: -8px; transform: none; min-width: 220px; }
.warning-popover span { display: block; }
.warning-popover span + span { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--colorNeutralStroke2); }
.warning-wrap:hover .warning-popover, .warning-wrap.active .warning-popover { display: block; }
tbody tr:has(.warning-wrap:hover), tbody tr:has(.warning-wrap.active) { position: relative; z-index: 20; }
tbody tr:has(.warning-wrap:hover) .sticky-rating, tbody tr:has(.warning-wrap.active) .sticky-rating { z-index: 30; }
tbody tr:nth-last-child(-n + 2) .warning-popover { top: auto; bottom: calc(100% + 9px); }
.empty-cell { padding: 38px; text-align: center; color: var(--colorNeutralForeground3); }
.scoreboard-foot { padding: 12px 18px; border-top: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: flex-end; }
@media (max-width: 900px) {
  .contest-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .scoreboard-search { width: 100%; }
  .scoreboard-search__field { width: 100%; }
  .rank-col { width: 42px; min-width: 42px; padding-inline: 4px; }
  .user-col { width: 180px; min-width: 180px; padding-inline: 6px; overflow: hidden; text-overflow: ellipsis; }
  .rating-col { width: 104px; min-width: 104px; padding-inline: 4px; }
  .sticky-rank { left: 0; }
  .sticky-user { left: 42px; }
  .sticky-rating { left: 222px; }
  .warning-popover { position: fixed; top: auto; left: 50%; right: auto; bottom: 24px; transform: translateX(-50%); width: min(280px, calc(100vw - 40px)); }
  .scoreboard-foot { justify-content: center; }
}
</style>
