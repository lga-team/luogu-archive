<script setup lang="ts">
import { Gavel, RefreshCw } from 'lucide-vue-next'

useHead({ title: '陶片放逐 - 洛谷档案馆' })
const { smart } = useTime()
const api = useApi()

interface UserBrief { uid: number; name: string; color: string; badge: string | null; avatar: string | null }
interface JudgementGroup {
  group_key: string
  reason: string
  revoked_permission: number
  added_permission: number
  time_start: string
  time_end: string
  users: UserBrief[]
  count: number
}

const PAGE_SIZE = 50
const groups = ref<JudgementGroup[]>([])
const loading = ref(false)
const noMore = ref(false)
const beforeTs = ref<string | null>(null)

const { data: firstPage, status: firstStatus, error: firstError } = useLazyAsyncData('judgement-first', () =>
  api<JudgementGroup[]>('/judgement', { query: { limit: PAGE_SIZE } }),
  { server: false },
)
const { data: lastCrawled } = useLazyAsyncData('judgement-last-crawled', () =>
  api<{ last_crawled_at: string | null }>('/last-crawled?type=judgement'),
  { server: false },
)
const recordsPending = computed(() => firstStatus.value === 'idle' || firstStatus.value === 'pending')

watch(firstPage, (page) => {
  if (!page) return
  groups.value = [...page]
  beforeTs.value = page.length ? page[page.length - 1].time_start : null
  noMore.value = page.length === 0
}, { immediate: true })

async function loadMore() {
  if (loading.value || noMore.value) return
  loading.value = true
  try {
    const q: Record<string, any> = { limit: PAGE_SIZE }
    if (beforeTs.value) q.before = beforeTs.value
    const page = await api<JudgementGroup[]>('/judgement', { query: q })
    if (page.length === 0) {
      noMore.value = true
    } else {
      const seen = new Set(groups.value.map(g => g.group_key))
      const fresh = page.filter(g => !seen.has(g.group_key))
      groups.value.push(...fresh)
      beforeTs.value = page[page.length - 1].time_start
    }
  } finally {
    loading.value = false
  }
}

const PERMISSION_MAP: Array<[number, string]> = [
  [1, '登录授权'], [2, '进入主站'], [4, '进入后台'], [8, '题目管理'],
  [16, '团队管理'], [32, '比赛管理'], [64, '讨论管理'], [256, '用户管理'],
  [512, '专栏管理'], [32768, '自由发言'], [65536, '发送私信'], [131072, '使用专栏'],
  [524288, '使用图床'], [2097152, '题目志愿者'], [4194304, '专栏志愿者'],
]
function describePermission(bits: number): string[] {
  if (!bits) return []
  const out: string[] = []
  let remaining = bits
  for (const [v, label] of PERMISSION_MAP) {
    if ((bits & v) === v) { out.push(label); remaining &= ~v }
  }
  if (remaining) out.push(`未知位 (${remaining})`)
  return out
}
function formatTime(t: string): string { return smart(t) }
function actionLabel(g: JudgementGroup) {
  if (g.revoked_permission > 0 && g.added_permission === 0) return '撤销权限'
  if (g.added_permission > 0 && g.revoked_permission === 0) return '授予权限'
  if (g.revoked_permission === 0 && g.added_permission === 0) return '棕名惩罚'
  return '权限变更'
}
function actionClass(g: JudgementGroup) {
  if (g.revoked_permission === 0 && g.added_permission === 0) return 'tag--warn'
  return g.revoked_permission > 0 ? 'tag--danger' : 'tag--success'
}
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="陶片放逐"
      description="公开的洛谷用户处罚与权限变更记录，按时间倒序归档。"
      eyebrow="Judgement"
    >
      <template #icon><Gavel :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span v-if="lastCrawled?.last_crawled_at" class="meta-item">
          <RefreshCw :size="13" aria-hidden="true" />上次抓取 {{ formatTime(lastCrawled.last_crawled_at) }}
        </span>
      </template>
      <template #actions>
        <SaveButton content-type="judgement" content-id="all">
          <template #default="{ state, message, save }">
            <FButton appearance="outline" :loading="state === 'pending'" @click="save">
              <template #start><RefreshCw v-if="state !== 'pending'" :size="15" aria-hidden="true" /></template>
              {{ state === 'idle' ? '更新记录' : message || '处理中…' }}
            </FButton>
          </template>
        </SaveButton>
      </template>
    </PageHeader>

    <LoadingPanel v-if="recordsPending && !groups.length" variant="list" :rows="5" title="正在加载记录" />

    <div v-else-if="firstError && !groups.length" class="notice notice--warn" role="alert">
      <span>记录加载失败，请刷新页面重试。</span>
    </div>

    <div v-else-if="groups.length" class="judgement-list">
      <article v-for="g in groups" :key="g.group_key" class="card judgement-item">
        <header class="judgement-head">
          <span class="tag" :class="actionClass(g)">{{ actionLabel(g) }}</span>
          <span v-if="g.count > 1" class="tag tag--warn">{{ g.count }} 人</span>
          <time class="muted" :datetime="g.time_end">{{ formatTime(g.time_end) }}</time>
        </header>

        <div class="judgement-users">
          <NuxtLink v-for="u in g.users" :key="u.uid" :to="`/user/${u.uid}`" class="judgement-user">
            <LuoguAvatar :user="u" :size="32" />
            <LuoguUserName :user="u" show-badge no-link />
          </NuxtLink>
        </div>

        <div v-if="describePermission(g.revoked_permission).length || describePermission(g.added_permission).length" class="judgement-perms">
          <div v-if="describePermission(g.revoked_permission).length" class="perm-row">
            <span class="perm-row__label danger-text">撤销</span>
            <span v-for="p in describePermission(g.revoked_permission)" :key="'r-' + p" class="tag tag--danger">{{ p }}</span>
          </div>
          <div v-if="describePermission(g.added_permission).length" class="perm-row">
            <span class="perm-row__label success-text">授予</span>
            <span v-for="p in describePermission(g.added_permission)" :key="'a-' + p" class="tag tag--success">{{ p }}</span>
          </div>
        </div>

        <p v-if="g.reason" class="judgement-reason">{{ g.reason }}</p>
      </article>
    </div>

    <EmptyState v-else title="暂无记录" description="还没有公开的陶片放逐记录。" />

    <div v-if="groups.length" class="cluster" style="justify-content: center; padding: 8px 0">
      <FButton v-if="!noMore" appearance="outline" :loading="loading" @click="loadMore">
        {{ loading ? '加载中…' : '加载更多' }}
      </FButton>
      <span v-else class="muted" style="font-size: 13px">没有更多了</span>
    </div>
  </div>
</template>

<style scoped>
.judgement-list { display: flex; flex-direction: column; gap: 12px; }
.judgement-item { padding: 16px 18px; display: flex; flex-direction: column; gap: 11px; }
.judgement-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.judgement-head time { margin-left: auto; font-size: 12px; }
.judgement-users { display: flex; flex-wrap: wrap; gap: 4px; }
.judgement-user {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 3px 10px 3px 3px; border-radius: 999px;
  color: var(--colorNeutralForeground1); font-size: 14px; font-weight: 600;
  text-decoration: none;
}
.judgement-user:hover { background: var(--colorNeutralBackground1Hover); text-decoration: none; }
.judgement-user img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.judgement-perms { display: flex; flex-direction: column; gap: 5px; }
.perm-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.perm-row__label { font-weight: 600; font-size: 12px; min-width: 28px; }
.judgement-reason {
  padding-top: 9px; border-top: 1px dashed var(--colorNeutralStroke2);
  font-size: 13px; color: var(--colorNeutralForeground2); line-height: 1.65; white-space: pre-wrap;
}
@media (max-width: 680px) {
  .judgement-item { padding: 14px; }
  .judgement-head time { margin-left: 0; flex-basis: 100%; }
}
</style>
