<script setup lang="ts">
definePageMeta({ key: route => route.path })
const route = useRoute()
const api = useApi()
const { smart, format } = useTime()
const uid = route.params.uid as string

interface UserNameHistoryItem {
  name: string
  color: string
  badge: string | null
  ccf_level: number
  xcpc_level: number
  first_seen_at: string
  last_seen_at: string
  is_hidden: boolean
}

interface UserProfile {
  uid: number
  name: string
  avatar: string | null
  background: string | null
  slogan: string | null
  badge: string | null
  color: string
  is_admin: boolean
  is_banned: boolean
  ccf_level: number
  xcpc_level: number
  following_count: number
  follower_count: number
  ranking: number | null
  passed_problem_count: number | null
  submitted_problem_count: number | null
  register_time: string | null
  introduction_md: string | null
  last_crawled_at: string | null
  name_history: UserNameHistoryItem[]
  prizes: Array<{ year: number; contest: string; event: string | null; prize: string; score: number | null; rank: number | null }>
  name_hidden: boolean
}

interface ActivityItem {
  kind: string
  time: string
  feed_id?: number
  feed_content?: string
  feed_merged_suffix_md?: string | null
  feed_merged_from_id?: number | null
  feed_merged_link_md?: string[]
  feed_merged_image_md?: string[]
  article_id?: string
  article_title?: string
  paste_id?: string
  discussion_id?: number
  discussion_title?: string
  discussion_excerpt?: string
  discussion_reply_count?: number
  discussion_reply_id?: number
  discussion_reply_page?: number
  discussion_reply_excerpt?: string
  judgement_reason?: string
  judgement_revoked?: number
  judgement_added?: number
}

// 活动种类的中文标签
const KIND_LABEL: Record<string, string> = {
  feed: '动态',
  article: '文章',
  paste: '剪贴板',
  discussion: '发起讨论',
  discussion_reply: '回复讨论',
  judgement: '陶片放逐',
}

// 陶片权限位图（沿用陶片页的常量，单点维护建议后续抽 composable）
const PERMISSION_MAP: Array<[number, string]> = [
  [1, '登录授权'],
  [2, '进入主站'],
  [4, '进入后台'],
  [8, '题目管理'],
  [16, '团队管理'],
  [32, '比赛管理'],
  [64, '讨论管理'],
  [256, '用户管理'],
  [512, '专栏管理'],
  [32768, '自由发言'],
  [65536, '发送私信'],
  [131072, '使用专栏'],
  [524288, '使用图床'],
  [2097152, '题目志愿者'],
  [4194304, '专栏志愿者'],
]

function describePermission(bits: number): string[] {
  if (!bits) return []
  const out: string[] = []
  let remaining = bits
  for (const [v, label] of PERMISSION_MAP) {
    if ((bits & v) === v) {
      out.push(label)
      remaining &= ~v
    }
  }
  if (remaining) out.push(`未知位 (${remaining})`)
  return out
}

const { data: profile, error, status: profileStatus } = useLazyAsyncData(`user-${uid}`, () =>
  api<UserProfile>(`/user/${uid}`),
  { server: false },
)
useHead({ title: computed(() => profile.value ? `${profile.value.name_hidden ? `UID ${uid}` : profile.value.name} - 用户档案 - 洛谷档案馆` : '用户档案 - 洛谷档案馆') })

// 等级分只取官方缓存，独立加载，不阻塞资料卡，也不触发额外爬取。
const { data: ratingHistory, execute: loadRatingHistory } = useLazyAsyncData(
  `user-rating-${uid}`,
  () => api<Array<{ rating: number | null }>>(`/user/${uid}/rating-history`),
  { server: false, immediate: false },
)
watch(() => profile.value?.last_crawled_at, () => {
  if (profile.value) void loadRatingHistory()
}, { immediate: true })
const latestRating = computed(() => ratingHistory.value?.at(-1)?.rating ?? null)
const profileStats = computed(() => [
  { label: '关注', value: profile.value?.following_count },
  { label: '粉丝', value: profile.value?.follower_count },
  { label: '提交', value: profile.value?.submitted_problem_count },
  { label: '通过', value: profile.value?.passed_problem_count },
  { label: '排名', value: profile.value?.ranking },
  { label: '等级分', value: latestRating.value },
])
const userType = computed(() => profile.value?.is_banned ? '封禁用户' : profile.value?.is_admin ? '管理员' : '普通用户')
const registrationDate = computed(() => {
  const value = profile.value?.register_time
  return value && !Number.isNaN(new Date(value).getTime()) ? format(value, 'YYYY-MM-DD') : '-'
})
const compactCount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
function formatProfileStat(value: number | null | undefined, label: string) {
  if (value == null || !Number.isFinite(value)) return '-'
  // 等级分保留精确整数；其他长计数用紧凑格式，悬停仍能查看完整值。
  return label === '等级分' ? String(value) : compactCount.format(value).toLowerCase()
}

const includeFeed = ref(true)
const includeDiscussion = ref(true)
// 活动列表分页：游标 = 列表最后一条的 time（更老的时间）
const activity = ref<ActivityItem[]>([])
const activityLoading = ref(false)
const activityNoMore = ref(false)
const activityBefore = ref<string | null>(null)
const activityError = ref('')
// 筛选变化后丢弃旧请求结果，避免快速切换开关时串入上一次筛选的数据。
let activityRequestVersion = 0
const PAGE_SIZE = 50

// 活动第一页同样懒加载，避免用户资料页等待活动接口。
const { data: firstPage, status: activityInitialStatus, error: activityInitialError } = useLazyAsyncData(
  `user-activity-${uid}`,
  () =>
    api<ActivityItem[]>(`/user/${uid}/activity`, {
      query: {
        include_feed: includeFeed.value,
        include_discussion: includeDiscussion.value,
        limit: PAGE_SIZE,
      },
    }),
  { server: false },
)
const activityInitialPending = computed(() => activityInitialStatus.value === 'idle' || activityInitialStatus.value === 'pending')

watch(firstPage, (page) => {
  if (!page || activityRequestVersion !== 0) return
  activity.value = [...page]
  activityBefore.value = page.length ? page[page.length - 1].time : null
  activityNoMore.value = page.length < PAGE_SIZE
}, { immediate: true })

async function loadMoreActivity() {
  if (activityLoading.value || activityInitialPending.value || activityNoMore.value) return
  const requestVersion = activityRequestVersion
  activityLoading.value = true
  activityError.value = ''
  try {
    const q: Record<string, any> = {
      include_feed: includeFeed.value ? 'true' : 'false',
      include_discussion: includeDiscussion.value,
      limit: PAGE_SIZE,
    }
    if (activityBefore.value) q.before = activityBefore.value
    const page = await api<ActivityItem[]>(`/user/${uid}/activity`, { query: q })
    if (requestVersion !== activityRequestVersion) return
    if (page.length === 0) {
      activityNoMore.value = true
    } else {
      activity.value.push(...page)
      activityBefore.value = page[page.length - 1].time
      if (page.length < PAGE_SIZE) activityNoMore.value = true
    }
  } catch (e: any) {
    if (requestVersion === activityRequestVersion) activityError.value = e?.data?.message || '活动加载失败，请重试。'
  } finally {
    if (requestVersion === activityRequestVersion) activityLoading.value = false
  }
}

// 两种活动独立筛选；切换后重新分页，避免隐藏内容占用返回条数。
async function reloadActivity() {
  const requestVersion = ++activityRequestVersion
  activity.value = []
  activityBefore.value = null
  activityNoMore.value = false
  activityLoading.value = true
  activityError.value = ''
  try {
    const page = await api<ActivityItem[]>(`/user/${uid}/activity`, {
      query: {
        include_feed: includeFeed.value,
        include_discussion: includeDiscussion.value,
        limit: PAGE_SIZE,
      },
    })
    if (requestVersion !== activityRequestVersion) return
    activity.value = page
    if (page.length === 0) {
      activityNoMore.value = true
    } else {
      activityBefore.value = page[page.length - 1].time
      if (page.length < PAGE_SIZE) activityNoMore.value = true
    }
  } catch (e: any) {
    if (requestVersion === activityRequestVersion) activityError.value = e?.data?.message || '活动加载失败，请重试。'
  } finally {
    if (requestVersion === activityRequestVersion) activityLoading.value = false
  }
}
watch([includeFeed, includeDiscussion], reloadActivity)

const { render } = useMarkdown()
const introHtml = computed(() =>
  profile.value?.introduction_md ? render(profile.value.introduction_md) : '',
)
const completionTip = '此内容由洛谷档案馆根据回复链自动补全'

function markMergedMedia(html: string, links: string[], images: string[]) {
  let marked = html
  for (const link of links) {
    const anchor = render(link).match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0]
    if (!anchor || !marked.includes(anchor)) continue
    marked = marked.replace(
      anchor,
      `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged-link">${anchor}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`,
    )
  }
  for (const imageMd of images) {
    const image = render(imageMd).match(/<img\b[^>]*>/i)?.[0]
    if (!image || !marked.includes(image)) continue
    marked = marked.replace(
      image,
      `<span class="feed-completion-wrap feed-auto-merged-image" tabindex="0">${image}<span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`,
    )
  }
  return marked
}

function renderMergedSuffix(content: string, mergedSuffix: string) {
  const prefix = content.slice(0, Math.max(0, content.length - mergedSuffix.length))
  const prefixHtml = render(prefix)
  const suffixHtml = render(mergedSuffix)
  const suffixParagraph = suffixHtml.match(/^<p>([\s\S]*)<\/p>\s*$/)

  // 普通文字尾巴接回原段落；只有原 Markdown 明确换行或包含多个块时才另起一行。
  if (!mergedSuffix.startsWith('\n') && suffixParagraph && /<\/p>\s*$/.test(prefixHtml)) {
    const markedSuffix = `<span class="feed-completion-wrap" tabindex="0"><span class="feed-auto-merged">${suffixParagraph[1]}</span><span class="feed-completion-popover" role="tooltip">${completionTip}</span></span>`
    return prefixHtml.replace(/<\/p>\s*$/, `${markedSuffix}</p>`)
  }

  return prefixHtml
    + `<div class="feed-completion-wrap feed-completion-block" tabindex="0"><div class="feed-auto-merged">${suffixHtml}</div><span class="feed-completion-popover" role="tooltip">${completionTip}</span></div>`
}

function feedHtml(
  content: string,
  mergedSuffix?: string | null,
  mergedLinks: string[] = [],
  mergedImages: string[] = [],
) {
  let html = mergedSuffix
    ? renderMergedSuffix(content, mergedSuffix)
    : render(content)
  if (mergedLinks.length || mergedImages.length) {
    html = markMergedMedia(html, mergedLinks, mergedImages)
  }
  return html
}

const copiedIntroOriginal = ref(false)
const copyError = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined
async function copyIntroOriginal() {
  if (!profile.value?.introduction_md) return
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(profile.value.introduction_md)
    copiedIntroOriginal.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copiedIntroOriginal.value = false }, 1400)
  } catch {
    copyError.value = '复制失败，请检查浏览器剪贴板权限。'
  }
}
onBeforeUnmount(() => {
  activityRequestVersion++
  if (copyTimer) clearTimeout(copyTimer)
})

const userBrief = computed(() => profile.value ? {
  uid: profile.value.uid,
  name: profile.value.name,
  color: profile.value.color,
  badge: profile.value.badge,
  avatar: profile.value.avatar,
  ccf_level: profile.value.ccf_level,
  xcpc_level: profile.value.xcpc_level,
  is_admin: profile.value.is_admin,
} : null)

interface CollapsedNameHistoryItem extends UserNameHistoryItem {
  id: string
}

// 兼容旧数据：只合并时间线上相邻且外显完全相同的快照，不跨越中间变化。
const nameHistory = computed<CollapsedNameHistoryItem[]>(() => {
  const ordered = [...(profile.value?.name_history ?? [])].sort(
    (a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime(),
  )
  const collapsed: CollapsedNameHistoryItem[] = []

  for (const entry of ordered) {
    const key = [
      entry.is_hidden ? 'hidden' : entry.name,
      entry.color,
      entry.badge ?? '',
      entry.ccf_level,
      entry.xcpc_level,
    ].join('|')
    const tail = collapsed[collapsed.length - 1]
    const tailKey = tail
      ? [
          tail.is_hidden ? 'hidden' : tail.name,
          tail.color,
          tail.badge ?? '',
          tail.ccf_level,
          tail.xcpc_level,
        ].join('|')
      : null

    if (tail && tailKey === key) {
      if (new Date(entry.first_seen_at) < new Date(tail.first_seen_at)) {
        tail.first_seen_at = entry.first_seen_at
      }
      if (new Date(entry.last_seen_at) > new Date(tail.last_seen_at)) {
        tail.last_seen_at = entry.last_seen_at
      }
      continue
    }

    collapsed.push({
      ...entry,
      id: `${entry.first_seen_at}-${collapsed.length}`,
    })
  }
  return collapsed
})

function historyUser(entry: UserNameHistoryItem) {
  return {
    uid: profile.value?.uid ?? Number(uid),
    name: entry.name,
    color: entry.color,
    badge: entry.badge,
    avatar: null,
    ccf_level: entry.ccf_level,
    xcpc_level: entry.xcpc_level,
  }
}

// 左侧 Tab 切换
type TabKey = 'activity' | 'intro' | 'prizes' | 'names'
const activeTab = ref<TabKey>('activity')

const tabs: Array<{ key: TabKey; label: string; show: () => boolean }> = [
  { key: 'activity', label: '活动', show: () => true },
  { key: 'intro', label: '个人介绍', show: () => !!profile.value?.introduction_md },
  { key: 'prizes', label: 'OI 获奖', show: () => (profile.value?.prizes?.length ?? 0) > 0 },
  { key: 'names', label: '用户名历史', show: () => nameHistory.value.length > 1 },
]
const visibleTabs = computed(() => tabs.filter(tab => tab.show()).map(({ key, label }) => ({ key, label })))
function selectTab(tab: string) {
  if (visibleTabs.value.some(item => item.key === tab)) activeTab.value = tab as TabKey
}

// 代码复制按钮：绑在右侧内容容器上，覆盖 activity / intro 两种 md 场景
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

// XCPC 的 score 是浮点（penalty 算法），OI 是整数；整数原样、浮点保留 2 位小数
function formatScore(s: number): string {
  return Number.isInteger(s) ? String(s) : s.toFixed(2)
}
</script>

<template>
  <div ref="contentRef" class="user-page">
    <div class="two-col">
      <!-- 右侧：用户资料、操作与栏目 -->
      <aside class="sidebar">
        <section v-if="profile" class="profile-head archive-card">
          <div class="profile-identity">
            <img v-if="profile.avatar" :src="profile.avatar" class="avatar" alt="" width="64" height="64">
            <div v-else class="avatar avatar-fallback" aria-hidden="true">{{ profile.name_hidden ? '?' : profile.name.slice(0, 1) }}</div>
            <div class="profile-identity-copy">
              <h1 class="name-row">
                <LuoguUserName :user="userBrief" :hidden="profile.name_hidden" show-badge no-link />
              </h1>
              <p v-if="profile.slogan" class="slogan">{{ profile.slogan }}</p>
            </div>
          </div>

          <dl class="profile-details">
            <div><dt>用户编号</dt><dd>{{ profile.uid ?? '-' }}</dd></div>
            <div><dt>用户类型</dt><dd>{{ userType }}</dd></div>
            <div><dt>注册时间</dt><dd>{{ registrationDate }}</dd></div>
            <div v-if="profile.ccf_level > 0"><dt>OI 程序设计能力</dt><dd>{{ profile.ccf_level }} 级</dd></div>
            <div v-if="profile.xcpc_level > 0"><dt>ICPC/CCPC 程序设计能力</dt><dd>{{ profile.xcpc_level }} 级</dd></div>
          </dl>
          <dl class="stats">
            <div v-for="stat in profileStats" :key="stat.label"><dt>{{ stat.label }}</dt><dd :title="stat.value == null ? undefined : String(stat.value)">{{ formatProfileStat(stat.value, stat.label) }}</dd></div>
          </dl>
        </section>
        <FollowButton :uid="Number(uid)">
          <template #default="{ following, loading, toggle }">
            <SaveButton content-type="user" :content-id="uid">
              <template #default="{ state, message, save }">
                <UserControls mode="toolbar" :uid="uid" :state="state" :message="message" :updated-at="profile?.last_crawled_at ? smart(profile.last_crawled_at) : ''" :show-profile-actions="!!profile" :following="following" :pending="loading" @update="save" @follow="toggle" @card="navigateTo(`/user/${uid}/card`)" />
              </template>
            </SaveButton>
          </template>
        </FollowButton>
        <div v-if="profile" class="user-sidebar-navigation">
          <UserControls mode="tabs" :tabs="visibleTabs" :active-tab="activeTab" @tab="selectTab" />
        </div>
      </aside>

      <!-- 左侧：栏目内容 -->
      <div v-if="profile" class="content">
        <!-- 活动 -->
        <section v-if="activeTab === 'activity'">
          <div class="section-head activity-heading">
            <h2>活动</h2>
            <UserControls mode="filters" :include-feed="includeFeed" :include-discussion="includeDiscussion" @feed="includeFeed = $event" @discussion="includeDiscussion = $event" />
          </div>
          <LoadingPanel
            v-if="(activityInitialPending || activityLoading) && !activity.length"
            title="正在加载活动记录"
            text=""
          />

          <ul v-else-if="activity && activity.length" class="activity-list">
            <li v-for="(a, idx) in activity" :key="idx" :class="`act-${a.kind}`" class="archive-card">
              <span class="kind-tag">{{ KIND_LABEL[a.kind] || a.kind }}</span>
              <span class="time">{{ smart(a.time) }}</span>
              <template v-if="a.kind === 'feed'">
                <div
                  class="lg-content"
                  v-html="feedHtml(a.feed_content || '', a.feed_merged_suffix_md, a.feed_merged_link_md || [], a.feed_merged_image_md || [])"
                />
                <div class="feed-foot">
                  <NuxtLink :to="`/feed/${a.feed_id}`" class="feed-id">#{{ a.feed_id }}</NuxtLink>
                  <FeedReplyButton
                    :content="a.feed_content || ''"
                    :sender-name="profile.name_hidden ? `UID ${profile.uid}` : profile.name"
                  />
                </div>
              </template>
              <template v-else-if="a.kind === 'article'">
                <div class="link-line">
                  <NuxtLink :to="`/article/${a.article_id}`">{{ a.article_title || a.article_id }}</NuxtLink>
                </div>
              </template>
              <template v-else-if="a.kind === 'paste'">
                <div class="link-line">
                  <NuxtLink :to="`/paste/${a.paste_id}`">剪贴板 {{ a.paste_id }}</NuxtLink>
                </div>
              </template>
              <template v-else-if="a.kind === 'discussion'">
                <h3 class="discussion-title">
                  <NuxtLink :to="`/discuss/${a.discussion_id}`">{{ a.discussion_title || `讨论 ${a.discussion_id}` }}</NuxtLink>
                </h3>
                <!-- 摘要使用后端生成的纯文本，避免半截 Markdown 破坏排版。 -->
                <p v-if="a.discussion_excerpt" class="discussion-excerpt">{{ a.discussion_excerpt }}</p>
                <div v-if="a.discussion_reply_count != null" class="discussion-stats">回复 {{ a.discussion_reply_count }}</div>
              </template>
              <template v-else-if="a.kind === 'discussion_reply'">
                <p class="discussion-context">
                  在讨论 <NuxtLink :to="a.discussion_reply_page ? `/discuss/${a.discussion_id}?page=${a.discussion_reply_page}#reply-${a.discussion_reply_id}` : `/discuss/${a.discussion_id}`">《{{ a.discussion_title || `讨论 ${a.discussion_id}` }}》</NuxtLink> 回复：
                </p>
                <blockquote class="discussion-quote">{{ a.discussion_reply_excerpt || '（暂无回复摘要）' }}</blockquote>
              </template>
              <template v-else-if="a.kind === 'judgement'">
                <div class="judgement-card">
                  <header class="head">
                    <span
                      class="action-tag"
                      :class="(a.judgement_revoked ?? 0) === 0 && (a.judgement_added ?? 0) === 0
                        ? 'cheater'
                        : ((a.judgement_revoked ?? 0) > 0 ? 'revoked' : 'added')"
                    >
                      <template v-if="(a.judgement_revoked ?? 0) > 0 && (a.judgement_added ?? 0) === 0">
                        撤销权限
                      </template>
                      <template v-else-if="(a.judgement_added ?? 0) > 0 && (a.judgement_revoked ?? 0) === 0">
                        授予权限
                      </template>
                      <template v-else-if="(a.judgement_revoked ?? 0) === 0 && (a.judgement_added ?? 0) === 0">
                        棕名惩罚
                      </template>
                      <template v-else>
                        权限变更
                      </template>
                    </span>
                  </header>

                  <div v-if="describePermission(a.judgement_revoked ?? 0).length" class="perm-row">
                    <span class="perm-label revoked">● 撤销</span>
                    <span
                      v-for="p in describePermission(a.judgement_revoked ?? 0)"
                      :key="`r-${idx}-${p}`"
                      class="perm-chip"
                    >{{ p }}</span>
                    <span class="perm-suffix">权限</span>
                  </div>
                  <div v-if="describePermission(a.judgement_added ?? 0).length" class="perm-row">
                    <span class="perm-label added">● 授予</span>
                    <span
                      v-for="p in describePermission(a.judgement_added ?? 0)"
                      :key="`a-${idx}-${p}`"
                      class="perm-chip"
                    >{{ p }}</span>
                    <span class="perm-suffix">权限</span>
                  </div>

                  <div class="reason">{{ a.judgement_reason }}</div>
                </div>
              </template>
            </li>
          </ul>
          <p v-else-if="!activityError && !(activityInitialError && activityRequestVersion === 0)" class="empty">暂无活动记录</p>
          <div v-if="activityError || (activityInitialError && activityRequestVersion === 0)" class="activity-error" role="alert">
            <p>{{ activityError || activityInitialError?.data?.message || '活动加载失败，请重试。' }}</p>
            <UserControls mode="retry" :pending="activityLoading" @action="reloadActivity" />
          </div>

          <!-- 加载更多 -->
          <div v-if="activity && activity.length" class="loader">
            <UserControls v-if="!activityNoMore" mode="more" :pending="activityLoading" @action="loadMoreActivity" />
            <span v-else class="empty">没有更多了</span>
          </div>
        </section>

        <!-- 个人介绍 -->
        <section v-if="activeTab === 'intro'" class="user-detail-panel archive-card">
          <div class="section-head">
            <h2>个人介绍</h2>
            <UserControls mode="copy" :copied="copiedIntroOriginal" @action="copyIntroOriginal" />
          </div>
          <p v-if="copyError" class="activity-error" role="alert">{{ copyError }}</p>
          <article class="lg-content" v-html="introHtml" />
        </section>

        <!-- OI 获奖 -->
        <section v-if="activeTab === 'prizes'" class="user-detail-panel archive-card">
          <h2>OI 获奖</h2>
          <div class="prize-table-scroll"><table class="prize-table">
            <thead>
              <tr>
                <th>年份</th>
                <th>赛事</th>
                <th>项目</th>
                <th>奖项</th>
                <th>分数</th>
                <th>排名</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, idx) in profile.prizes" :key="`${idx}-${p.contest}-${p.prize}`">
                <td>
                  <template v-if="p.year && p.year > 0">{{ p.year }}</template>
                  <span v-else class="hidden-cell">已隐藏</span>
                </td>
                <td>{{ p.contest }}</td>
                <td>{{ p.event || '—' }}</td>
                <td>{{ p.prize }}</td>
                <!-- score/rank 都为 null：合并两格，"已隐藏"在两列范围内居中 -->
                <td v-if="p.score === null && p.rank === null"
                    colspan="2" class="hidden-cell hidden-merged">已隐藏</td>
                <template v-else>
                  <td>{{ p.score !== null ? formatScore(p.score) : '—' }}</td>
                  <td>{{ p.rank !== null ? p.rank : '—' }}</td>
                </template>
              </tr>
            </tbody>
          </table></div>
        </section>

        <!-- 用户名外显历史 -->
        <section v-if="activeTab === 'names'" class="name-history-panel archive-card">
          <header class="name-history-head">
            <div>
              <h2>历史用户名外显</h2>
            </div>
            <span>{{ nameHistory.length }} 次记录</span>
          </header>

          <ol class="name-history-list">
            <li
              v-for="(h, index) in nameHistory"
              :key="h.id"
              :class="{ current: index === 0 }"
            >
              <span class="history-line" aria-hidden="true" />
              <span class="history-dot" aria-hidden="true" />
              <div class="history-content">
                <LuoguUserName
                  :user="historyUser(h)"
                  :hidden="h.is_hidden"
                  show-badge
                  no-link
                />
                <div class="history-time">
                  <span :title="h.first_seen_at">
                    最早追溯到 {{ format(h.first_seen_at, 'YYYY/MM/DD') }}
                  </span>
                  <span :title="h.last_seen_at">
                    最后捕获于 {{ format(h.last_seen_at, 'YYYY/MM/DD') }}
                  </span>
                </div>
              </div>
            </li>
          </ol>
        </section>
      </div>
      <div v-else-if="error" class="error-box archive-card" role="alert">
        <h2>{{ error.data?.message || '用户未收录' }}</h2>
        <p>已触发一次爬取，稍等片刻刷新即可。</p>
      </div>
      <LoadingPanel v-else-if="profileStatus === 'idle' || profileStatus === 'pending'" title="正在加载用户资料" text="" />
    </div>
  </div>
</template>

<style scoped>
.user-page {
  display: grid;
  gap: 16px;
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
}

.two-col {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  grid-template-areas: 'content sidebar';
  gap: 20px 16px;
  align-items: start;
}
.two-col > :not(.sidebar) { grid-area: content; min-width: 0; }
@media (max-width: 1000px) {
  .two-col { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'sidebar' 'content'; gap: 16px; }
}

.sidebar {
  container-type: inline-size;
  container-name: user-sidebar;
  grid-area: sidebar;
  min-width: 0;
  display: grid;
  gap: 16px;
  position: sticky;
  top: 18px;
  align-self: start;
}
@media (max-width: 1000px) {
  /* 手机端：sidebar 变普通块，跟随页面向上滚出视口；tab 横向铺开 */
  .sidebar {
    position: static;
    top: auto;
  }
}

.profile-head {
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 22px 20px;
  text-align: left;
  margin-bottom: 0;
}
.profile-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }
.profile-identity-copy { flex: 1; min-width: 0; }
.avatar {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid var(--border);
}
.avatar-fallback { display: grid; place-items: center; background: var(--hover); color: var(--text-muted); font-size: 24px; }
.name-row {
  margin: 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.name-row :deep(.lg-user-wrap) { justify-content: flex-start; flex-wrap: wrap; max-width: 100%; }
.name-row :deep(.lg-name) { min-width: 0; overflow-wrap: anywhere; }
.slogan {
  color: var(--text-muted);
  margin: 5px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.profile-details { display: grid; gap: 12px; margin: 22px 0 0; font-size: 14px; }
.profile-details > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 12px; }
.profile-details dt { margin: 0; font-weight: 500; overflow-wrap: anywhere; }
.profile-details dd { margin: 0; text-align: right; font-weight: 400; font-variant-numeric: tabular-nums; }

.card-link-btn {
  width: fit-content;
  margin: 10px auto 0;
  padding: 6px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  font-size: 14px;
}
.card-link-btn:hover {
  border-color: var(--link);
  color: var(--link);
  text-decoration: none;
}
.card-link-btn svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin: 22px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  text-align: center;
}
.stats > div {
  min-width: 0;
}
.stats dt { font-size: 12px; color: var(--text-muted); margin: 0 0 3px; }
.stats dd { margin: 0; font-weight: 400; font-size: 14px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

.tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
}
.tabs button {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  font: inherit;
}
.tabs button:hover { background: var(--hover); }
.tabs button.active {
  background: var(--link);
  color: #fff;
}

@media (max-width: 768px) {
  /* 手机端 tab 横向铺开，便于一行选 */
  .tabs {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .tabs button {
    flex: 1 0 auto;
    text-align: center;
  }
}

.content {
  display: block;
  min-width: 0;
  width: 100%;
}
.content h2 { margin-top: 0; font-size: 17px; font-weight: 600; }
.content > section { min-width: 0; }
.user-detail-panel { display: block; padding: 22px 24px; }
.activity-heading { padding: 2px 0 4px; }
.activity-error { color: var(--lg-red); font-size: 13px; }
.prize-table-scroll { overflow-x: auto; }
.user-detail-panel .prize-table { background: transparent; border: 0; border-radius: 0; min-width: 500px; }
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}
.section-head h2 { margin: 0; }
.activity-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.toggle {
  font-size: 14px;
  color: var(--text-muted);
  white-space: nowrap;
}
.section-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s, transform 0.1s;
}
.section-action-btn:hover {
  border-color: var(--link);
  color: var(--link);
  transform: translateY(-1px);
}
.section-action-btn svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.activity-list li {
  display: block;
  padding: 18px 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 12px;
}
.kind-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--hover);
  color: var(--text-muted);
  border-radius: 4px;
  margin-right: 8px;
}
.time {
  float: right;
  color: var(--text-muted);
  font-size: 13px;
  margin-left: 12px;
}
.link-line {
  /* 文章 / 剪贴板的链接独占一行，上方留空与 feed 内容块保持一致 */
  margin-top: 8px;
}
.discussion-excerpt {
  margin: 8px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.discussion-title {
  margin: 12px 0 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.discussion-title a { color: var(--text); }
.discussion-title a:hover { color: var(--link); }
.discussion-context {
  margin: 12px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.discussion-quote {
  margin: 10px 0 2px;
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--border);
  color: var(--text);
  line-height: 1.7;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.discussion-stats { margin-top: 10px; color: var(--text-muted); font-size: 12px; }
.name-history-panel {
  display: block;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.name-history-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}
.name-history-head h2 {
  margin: 0;
  font-size: 18px;
}
.name-history-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
.name-history-head > span {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 12px;
}
.name-history-list {
  margin: 0;
  padding: 8px 22px 12px;
  list-style: none;
}
.name-history-list li {
  position: relative;
  min-height: 66px;
  padding: 13px 0 13px 26px;
}
.history-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: var(--border);
}
.name-history-list li:first-child .history-line {
  top: 21px;
}
.name-history-list li:last-child .history-line {
  bottom: calc(100% - 22px);
}
.history-dot {
  position: absolute;
  top: 19px;
  left: 1px;
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--text-muted);
  box-shadow: 0 0 0 1px var(--border);
}
.name-history-list li.current .history-dot {
  background: var(--link);
  box-shadow: 0 0 0 1px var(--link);
}
.history-content {
  min-width: 0;
}
.history-time {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 16px;
  margin-top: 7px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}
.name-history-list li.current .history-time {
  color: var(--text);
  font-weight: 500;
}
@media (max-width: 520px) {
  .user-detail-panel { padding: 18px 16px; }
  .activity-list li { padding: 16px; }
  .name-history-head {
    padding: 16px;
  }
  .name-history-head > span {
    display: none;
  }
  .name-history-list {
    padding-right: 16px;
    padding-left: 16px;
  }
}
.feed-foot {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 自动补回内容使用淡蓝下划线，并提供与比赛页一致的悬浮说明。 */
.lg-content :deep(.feed-completion-wrap) {
  position: relative;
  display: inline;
  cursor: help;
  outline: none;
}
.lg-content :deep(.feed-completion-block) {
  display: block;
  width: fit-content;
  max-width: 100%;
}
.lg-content :deep(.feed-auto-merged) {
  text-decoration-line: underline;
  text-decoration-color: #7db9e8;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.lg-content :deep(.feed-auto-merged img) {
  box-shadow: 0 2px 0 #7db9e8;
}
.lg-content :deep(.feed-auto-merged-image) {
  display: inline-block;
  max-width: 100%;
  box-shadow: 0 2px 0 #7db9e8;
}
.lg-content :deep(.feed-auto-merged-image img) {
  display: block;
}
.lg-content :deep(.feed-auto-merged-link),
.lg-content :deep(.feed-auto-merged-link a) {
  text-decoration-line: underline;
  text-decoration-color: #7db9e8;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.lg-content :deep(.feed-completion-popover) {
  position: absolute;
  z-index: 30;
  top: calc(100% + 9px);
  left: 50%;
  display: none;
  width: max-content;
  max-width: 280px;
  padding: 8px 10px;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
  font-size: 12px;
  line-height: 1.55;
  text-align: left;
  white-space: normal;
  pointer-events: none;
}
.lg-content :deep(.feed-completion-wrap:hover > .feed-completion-popover),
.lg-content :deep(.feed-completion-wrap:focus-within > .feed-completion-popover) {
  display: block;
}
.feed-id {
  font-size: 11px;
  color: var(--text-muted);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  opacity: 0.55;
}

/* 陶片放逐迷你卡片（沿用陶片页样式，但不带头像名字） */
.judgement-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}
.judgement-card .head {
  display: flex;
  align-items: center;
}
.judgement-card .action-tag {
  font-size: 13px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
}
.judgement-card .action-tag.revoked { color: var(--lg-red); }
.judgement-card .action-tag.added { color: var(--lg-green); }
.judgement-card .action-tag.cheater { color: var(--lg-cheater-tag); }
.judgement-card .perm-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 14px;
  padding-left: 8px;
}
.judgement-card .perm-label { font-weight: 500; }
.judgement-card .perm-label.revoked { color: var(--lg-red); }
.judgement-card .perm-label.added { color: var(--lg-green); }
.judgement-card .perm-chip {
  background: var(--hover);
  border: 1px solid var(--border);
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 13px;
}
.judgement-card .perm-suffix {
  color: var(--text-muted);
  font-size: 13px;
}
.judgement-card .reason {
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  color: var(--text);
  font-size: 14px;
}
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 40px;
}
.prize-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  font-size: 14px;
}
.prize-table th,
.prize-table td {
  padding: 8px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.prize-table thead {
  background: var(--hover);
}
.prize-table th {
  font-weight: 600;
  color: var(--text-muted);
  font-size: 13px;
}
.prize-table tbody tr:last-child td {
  border-bottom: none;
}
.prize-table tbody tr:hover {
  background: var(--hover);
}
.hidden-cell {
  color: var(--text-muted);
  font-size: 13px;
}
.prize-table td.hidden-merged {
  text-align: center;
}
.loader {
  text-align: center;
  padding: 16px 0;
}
.loader button {
  padding: 8px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text);
  font: inherit;
}
.loader button:hover:not(:disabled) {
  border-color: var(--link);
  color: var(--link);
}
.loader button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.loader .empty {
  padding: 8px;
}
.error-box {
  padding: 30px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
}
</style>
