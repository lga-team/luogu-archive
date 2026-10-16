<script setup lang="ts">
const api = useApi()
const { format, smart } = useTime()
useHead({ title: '讨论区 - 洛谷档案馆' })
const page = ref(1)
const selectedForum = ref('')
const pageSize = 30

interface UserBrief {
  uid: number
  name: string
  color: string
  badge: string | null
  avatar: string | null
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
}

interface ForumItem {
  name: string
  slug: string
  count: number
}

interface DiscussionItem {
  discussion_id: number
  title: string
  author: UserBrief | null
  forum_name: string | null
  source_time: string | null
  crawled_at: string
  stored_reply_count: number
  latest_reply_author: UserBrief | null
  latest_reply_time: string | null
}

interface DiscussionListResponse {
  items: DiscussionItem[]
  forums: ForumItem[]
  total: number
  page: number
  page_size: number
}

const { data, status, error, refresh: refreshList } = useLazyAsyncData(
  'discussion-list',
  () => api<DiscussionListResponse>('/discuss', {
    query: {
      page: page.value,
      page_size: pageSize,
      forum: selectedForum.value || undefined,
    },
  }),
  { server: false, watch: [page, selectedForum] },
)
const recordsPending = computed(() => status.value === 'idle' || status.value === 'pending')
const { data: lastCrawled } = useLazyAsyncData(
  'discussion-last-crawled',
  () => api<{ last_crawled_at: string | null }>('/last-crawled', { query: { type: 'discovery_discuss' } }),
  { server: false },
)

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total || 0) / pageSize)))
const refreshState = ref<'idle' | 'pending' | 'success' | 'cooldown' | 'failed'>('idle')
const refreshMessage = ref('')
let resetTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => {
  clearTimeout(resetTimer)
})

async function updateDiscussions() {
  if (refreshState.value === 'pending') return
  clearTimeout(resetTimer)
  refreshState.value = 'pending'
  refreshMessage.value = ''
  try {
    const result = await api<{ queued: boolean; message: string; retry_after: number }>('/discuss/refresh', {
      method: 'POST',
    })
    refreshMessage.value = result.message || (result.queued ? '更新任务已提交' : `请在 ${result.retry_after || 60} 秒后重试`)
    refreshState.value = result.queued ? 'success' : 'cooldown'
  } catch (reason: any) {
    refreshMessage.value = reason?.data?.message || '更新请求失败，请稍后重试'
    refreshState.value = 'failed'
  }
  resetTimer = setTimeout(() => { refreshState.value = 'idle'; refreshMessage.value = '' }, 3000)
}

function chooseForum(slug: string) {
  if (selectedForum.value === slug) return
  selectedForum.value = slug
  page.value = 1
}
</script>

<template>
  <div class="discussion-directory">
    <DiscussionControls
      mode="header"
      :state="refreshState"
      :message="refreshMessage"
      :updated-at="lastCrawled?.last_crawled_at ? smart(lastCrawled.last_crawled_at) : ''"
      @update="updateDiscussions"
    />

    <div class="discussion-page">
    <aside class="forum-panel" aria-label="讨论版块">
      <DiscussionControls mode="forums" :forums="data?.forums || []" :selected-forum="selectedForum" @forum="chooseForum" />
    </aside>

    <section class="discussion-main" aria-label="已归档讨论" :aria-busy="recordsPending">
      <LoadingPanel v-if="recordsPending" title="正在加载记录" text="" />
      <div v-else-if="error" class="empty" role="alert">
        <p>{{ error.data?.message || '讨论列表加载失败，请重试。' }}</p>
        <DiscussionControls mode="retry" @retry="refreshList()" />
      </div>

      <div v-else class="discussion-list">
        <NuxtLink
          v-for="item in data?.items || []"
          :key="item.discussion_id"
          :to="`/discuss/${item.discussion_id}`"
          class="discussion-card archive-card"
        >
          <div class="post-author">
            <img
              v-if="item.author?.avatar"
              :src="item.author.avatar"
              alt=""
              class="avatar"
              loading="lazy"
              width="34"
              height="34"
            >
            <div v-else class="avatar avatar-fallback" aria-hidden="true">?</div>
          </div>

          <div class="post-main">
            <span class="discussion-title">{{ item.title }}</span>
            <div class="post-meta">
              <LuoguUserName v-if="item.author" :user="item.author" show-badge no-link />
              <span v-else class="muted">发帖人未收录</span>
              <time :datetime="item.source_time || item.crawled_at">
                {{ format(item.source_time || item.crawled_at) }}
              </time>
            </div>
          </div>

          <div class="post-status">
            <span class="forum-label">
              <i aria-hidden="true" />{{ item.forum_name || '未知版块' }}
            </span>
            <div class="reply-meta">
              <span class="reply-count">{{ item.stored_reply_count }} 条回复</span>
              <template v-if="item.latest_reply_author">
                <LuoguUserName :user="item.latest_reply_author" no-link />
                <time v-if="item.latest_reply_time" :datetime="item.latest_reply_time">
                  {{ format(item.latest_reply_time) }}
                </time>
              </template>
            </div>
          </div>
        </NuxtLink>

        <div v-if="!data?.items.length" class="empty">这个版块暂时没有已归档讨论</div>
      </div>

      <DiscussionControls
        v-if="!error && totalPages > 1"
        mode="pagination"
        :page="page"
        :total-pages="totalPages"
        :pending="recordsPending"
        @page="page = $event"
      />
    </section>
    </div>
  </div>
</template>

<style scoped>
.discussion-directory {
  display: grid;
  gap: 18px;
  max-width: 1180px;
  margin: 0 auto;
}
.discussion-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}
.forum-panel {
  position: sticky;
  top: 18px;
  min-width: 0;
}
.discussion-main { min-width: 0; }
.discussion-list { display: grid; gap: 10px; }
.discussion-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) minmax(180px, 30%);
  align-items: center;
  gap: 12px;
  min-height: 90px;
  box-sizing: border-box;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
.discussion-card:hover { border-color: var(--link); background: color-mix(in srgb, var(--link) 3%, var(--surface)); }
.avatar { display: block; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.avatar-fallback { display: grid; place-items: center; background: var(--hover); color: var(--text-muted); font-weight: 700; }
.post-main, .post-status { min-width: 0; }
.discussion-title { display: block; overflow-wrap: anywhere; font-size: 15px; font-weight: 500; line-height: 1.6; }
.post-meta, .reply-meta, .forum-label { display: flex; align-items: center; }
.post-meta { gap: 5px 9px; flex-wrap: wrap; margin-top: 6px; color: var(--text-muted); font-size: 12px; }
.post-status { display: grid; justify-items: end; gap: 9px; }
.forum-label { gap: 6px; color: var(--text-muted); font-size: 12px; }
.forum-label i { width: 8px; height: 8px; border-radius: 2px; background: var(--lg-blue); }
.reply-meta { justify-content: flex-end; gap: 5px 8px; flex-wrap: wrap; min-width: 0; color: var(--text-muted); font-size: 12px; }
.reply-count { white-space: nowrap; }
.muted { color: var(--text-muted); }
.empty { padding: 40px 20px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-muted); text-align: center; }
@media (max-width: 820px) {
  .discussion-page { grid-template-columns: 1fr; }
  .forum-panel { position: static; }
  .discussion-card { grid-template-columns: 34px minmax(0, 1fr); padding: 14px; }
  .post-status { grid-column: 2; justify-items: start; }
  .reply-meta { justify-content: flex-start; flex-wrap: wrap; }
}
</style>
