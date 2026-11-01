<script setup lang="ts">
import { Activity, ChartNoAxesColumn, ExternalLink, FileText, History, Trophy } from 'lucide-vue-next'

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
  if ((prefix && !prefixHtml) || !suffixHtml) return ''
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
const tabIcons: Record<string, any> = { activity: Activity, intro: FileText, prizes: Trophy, names: History }
const tabItems = computed(() => visibleTabs.value.map(tab => ({ id: tab.key, label: tab.label, icon: tabIcons[tab.key] })))
function selectTab(tab: string) {
  if (visibleTabs.value.some(item => item.key === tab)) activeTab.value = tab as TabKey
}
function activityTone(kind: string) {
  if (kind === 'feed') return 'tag--brand'
  if (kind === 'judgement') return 'tag--warn'
  if (kind === 'article') return 'tag--info'
  if (kind === 'discussion' || kind === 'discussion_reply') return 'tag'
  return 'tag'
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
            <LuoguAvatar :user="profile" :size="60" :hidden="profile.name_hidden" class="avatar" />
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
        <div v-if="profile" class="user-filters archive-card">
          <div class="user-filters-head">
            <h2>活动筛选</h2>
            <span class="muted">只影响活动列表</span>
          </div>
          <UserControls
            mode="filters"
            :include-feed="includeFeed"
            :include-discussion="includeDiscussion"
            @feed="includeFeed = $event"
            @discussion="includeDiscussion = $event"
          />
        </div>
      </aside>

      <!-- 左侧：栏目内容 -->
      <div v-if="profile" class="content">
        <!-- 活动 -->
        <section v-if="activeTab === 'activity'">
          <div class="section-head activity-heading">
            <div>
              <h2>活动</h2>
              <span class="muted" style="font-size: 12px">公开动态、文章、讨论与陶片记录</span>
            </div>
            <span class="tag">{{ activity.length }} 条</span>
          </div>
          <LoadingPanel
            v-if="(activityInitialPending || activityLoading) && !activity.length"
            variant="list"
            :rows="4"
            title="正在加载活动记录"
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
            <p>{{ activityError || (activityInitialError as any)?.data?.message || '活动加载失败，请重试。' }}</p>
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
          <MarkdownBody :source="profile.introduction_md" class="lg-content" />
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
        <h2>{{ (error as any)?.data?.message || '用户未收录' }}</h2>
        <p>已触发一次爬取，稍等片刻刷新即可。</p>
      </div>
      <LoadingPanel v-else-if="profileStatus === 'idle' || profileStatus === 'pending'" title="正在加载用户资料" text="" />
    </div>
  </div>
</template>

<style scoped>
/* 新版 Fluent 用户档案布局：内容在左、资料与操作在右。 */
.user-page { width: 100%; }
.two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-areas: 'content sidebar';
  gap: 18px;
  align-items: start;
}
.two-col > :not(.sidebar) { grid-area: content; min-width: 0; }
.sidebar {
  grid-area: sidebar;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 16px;
}
.content { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

.profile-head {
  background:
    radial-gradient(420px 200px at 90% -30%, var(--colorBrandBackground2), transparent 70%),
    var(--colorNeutralBackground1);
  padding: 20px;
  text-align: left;
}
.profile-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }
.profile-identity-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.avatar { width: 60px; height: 60px; flex: 0 0 60px; object-fit: cover; border-radius: 50%; border: 1px solid var(--colorNeutralStroke2); }
.avatar-fallback { display: grid; place-items: center; background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-size: 22px; font-weight: 600; }
.name-row { margin: 0; font-size: 20px; overflow-wrap: anywhere; }
.name-row :deep(.lg-user-wrap) { justify-content: flex-start; flex-wrap: wrap; max-width: 100%; }
.slogan { margin: 0; color: var(--colorNeutralForeground3); font-size: 12.5px; line-height: 1.5; overflow-wrap: anywhere; }
.profile-details { display: flex; flex-direction: column; gap: 9px; margin: 16px 0 0; font-size: 12px; }
.profile-details > div { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.profile-details dt { color: var(--colorNeutralForeground3); }
.profile-details dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stats {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;
  margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--colorNeutralStroke2); text-align: center;
}
.stats dt { font-size: 10.5px; color: var(--colorNeutralForeground3); margin: 0 0 2px; }
.stats dd { margin: 0; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.user-sidebar-navigation { min-width: 0; }

.activity-heading { margin-bottom: 12px; }
.activity-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.activity-list > li {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 16px;
  border-left: 3px solid var(--colorNeutralStroke2);
}
.activity-list > li.act-feed { border-left-color: var(--colorBrandStroke1); }
.activity-list > li.act-discussion,
.activity-list > li.act-discussion_reply { border-left-color: #13C2C2; }
.activity-list > li.act-judgement { border-left-color: var(--colorPaletteDarkOrangeForeground1, #8a3707); }
.kind-tag {
  display: inline-flex; align-items: center; align-self: flex-start;
  padding: 1px 7px; border-radius: var(--borderRadiusSmall);
  background: var(--colorNeutralBackground2); color: var(--colorNeutralForeground3);
  font-size: 11px; font-weight: 600;
}
.time { color: var(--colorNeutralForeground3); font-size: 11px; margin-left: auto; }
.activity-list > li > .kind-tag + .time { position: absolute; }
.activity-list > li { position: relative; }
.activity-list > li > .time { position: absolute; top: 14px; right: 16px; }
.feed-foot { display: flex; align-items: center; gap: 10px; padding-top: 6px; border-top: 1px solid var(--colorNeutralStroke2); }
.feed-id { color: var(--colorNeutralForeground3); font-family: var(--fontFamilyMonospace); font-size: 11px; }
.link-line { font-weight: 600; font-size: 14px; }
.link-line a { color: var(--colorNeutralForeground1); text-decoration: none; }
.link-line a:hover { color: var(--colorBrandForeground1); }
.discussion-title { margin: 0; font-size: 14.5px; font-weight: 600; }
.discussion-title a { color: var(--colorNeutralForeground1); text-decoration: none; }
.discussion-title a:hover { color: var(--colorBrandForeground1); }
.discussion-excerpt { margin: 0; color: var(--colorNeutralForeground3); font-size: 13px; line-height: 1.6; }
.discussion-stats { color: var(--colorNeutralForeground3); font-size: 11px; }
.discussion-context { margin: 0; color: var(--colorNeutralForeground3); font-size: 13px; }
.discussion-quote {
  margin: 0; padding: 9px 12px; border-left: 3px solid var(--colorBrandStroke1);
  border-radius: 0 var(--borderRadiusMedium) var(--borderRadiusMedium) 0;
  background: var(--colorNeutralBackground2); color: var(--colorNeutralForeground2); font-size: 13px;
}
.judgement-card { display: flex; flex-direction: column; gap: 7px; }
.judgement-card .head { display: flex; align-items: center; gap: 8px; }
.action-tag { display: inline-flex; padding: 1px 8px; border-radius: var(--borderRadiusSmall); font-size: 11px; font-weight: 600; }
.action-tag.revoked { background: var(--colorPaletteRedBackground1, #fde7e9); color: var(--colorPaletteRedForeground1, #b10e1c); }
.action-tag.added { background: var(--colorPaletteGreenBackground1, #dff6dd); color: var(--colorPaletteGreenForeground1, #0e700e); }
.action-tag.cheater { background: var(--colorPaletteDarkOrangeBackground1, #fdf6ce); color: var(--colorPaletteDarkOrangeForeground1, #8a3707); }
.perm-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 12px; }
.perm-label { font-weight: 600; font-size: 12px; }
.perm-label.revoked { color: var(--colorPaletteRedForeground1, #b10e1c); }
.perm-label.added { color: var(--colorPaletteGreenForeground1, #0e700e); }
.perm-chip { padding: 1px 7px; border-radius: var(--borderRadiusSmall); background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); font-size: 11px; }
.perm-suffix { color: var(--colorNeutralForeground3); font-size: 11px; }
.reason { padding-top: 7px; border-top: 1px dashed var(--colorNeutralStroke2); font-size: 12.5px; color: var(--colorNeutralForeground2); }
.empty { padding: 34px 20px; text-align: center; color: var(--colorNeutralForeground3); }
.activity-error {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  padding: 12px 14px; border-radius: var(--borderRadiusLarge);
  background: var(--colorPaletteDarkOrangeBackground1, #fdf6ce); color: var(--colorPaletteDarkOrangeForeground1, #8a3707);
  font-size: 13px;
}
.activity-error p { margin: 0; }
.loader { display: flex; justify-content: center; padding: 6px 0; }

.user-detail-panel { padding: 18px 20px; }
.user-detail-panel > h2 { font-size: 17px; margin-bottom: 12px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.section-head h2 { margin: 0; font-size: 17px; }
.prize-table-scroll { overflow-x: auto; margin-top: 12px; }
.prize-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 13px; }
.prize-table th, .prize-table td { padding: 9px 12px; border-bottom: 1px solid var(--colorNeutralStroke2); text-align: left; }
.prize-table th { color: var(--colorNeutralForeground3); font-size: 11px; font-weight: 600; background: var(--colorNeutralBackground2); }
.hidden-cell { color: var(--colorNeutralForeground3); text-align: center; }

.name-history-panel { padding: 18px 20px; }
.name-history-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.name-history-head h2 { margin: 0; font-size: 17px; }
.name-history-head > span { color: var(--colorNeutralForeground3); font-size: 12px; }
.name-history-list { list-style: none; margin: 0; padding: 0; }
.name-history-list > li {
  position: relative; display: flex; gap: 12px; margin-left: 5px;
  padding: 8px 0 14px 20px; border-left: 1px solid var(--colorNeutralStroke2);
}
.name-history-list > li:last-child { border-left-color: transparent; padding-bottom: 0; }
.history-line { display: none; }
.history-dot {
  position: absolute; left: -4px; top: 14px; width: 7px; height: 7px;
  border-radius: 50%; background: var(--colorNeutralStroke1);
}
.name-history-list > li.current .history-dot { background: var(--colorBrandBackground); box-shadow: 0 0 0 3px var(--colorBrandBackground2); }
.history-content { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.history-time { display: flex; gap: 4px 12px; flex-wrap: wrap; color: var(--colorNeutralForeground3); font-size: 11px; }
.error-box { padding: 32px 20px; text-align: center; }
.error-box h2 { font-size: 18px; }
.error-box p { color: var(--colorNeutralForeground3); font-size: 13px; margin-top: 6px; }

@media (max-width: 1020px) {
  .two-col { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'sidebar' 'content'; gap: 14px; }
  .sidebar { position: static; }
}
@media (max-width: 680px) {
  .profile-head { padding: 16px; }
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .activity-list > li { padding: 12px 14px; }
  .activity-list > li > .time { position: static; }
  .user-detail-panel, .name-history-panel { padding: 15px; }
}

.user-filters { padding: 15px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--colorNeutralBackground2); box-shadow: none; }
.user-filters-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.user-filters-head h2 { font-size: 14px; font-weight: 600; }
.user-filters-head span { font-size: 10.5px; }
.user-filters :deep(.cluster) { flex-direction: column; align-items: flex-start; gap: 8px; }
.activity-heading { margin-bottom: 10px; }
.activity-heading h2 { font-size: 19px; }
.profile-head { padding: 18px; background: radial-gradient(320px 160px at 92% -20%, var(--colorBrandBackground2), transparent 70%), var(--colorNeutralBackground1); }
.name-row { font-size: 21px; }
.slogan { font-size: 12px; }
.stats { gap: 10px; }
.stats dd { font-size: 16px; }
</style>
