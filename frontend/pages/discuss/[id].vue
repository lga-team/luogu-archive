<script setup lang="ts">
const route = useRoute()
const api = useApi()
const { format, smart } = useTime()
const { render } = useMarkdown()
const id = Number(route.params.id)
definePageMeta({ key: route => route.path })
// 回复分页与洛谷一致，每页展示 10 条。
const perPage = 10
const currentPage = computed(() => Math.max(1, Number.parseInt(String(route.query.page || '1'), 10) || 1))

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

interface DiscussionReply {
  reply_id: number
  content_md: string
  author: UserBrief | null
  source_time: string | null
  crawled_at: string
}

interface DiscussionDetail {
  discussion_id: number
  title: string
  content_md: string
  author: UserBrief | null
  forum_name: string | null
  source_time: string | null
  crawled_at: string
  source_reply_count: number
  stored_reply_count: number
  page: number
  per_page: number
  replies: DiscussionReply[]
}

const { data, error, status, refresh } = useLazyAsyncData(
  `discussion-${id}`,
  () => api<DiscussionDetail>(`/discuss/${id}`, {
    query: { page: currentPage.value, per_page: perPage },
  }),
  { server: false, watch: [currentPage] },
)
const recordsPending = computed(() => status.value === 'idle' || status.value === 'pending')
useHead(() => ({ title: `${data.value?.title || `讨论 #${id}`} - 洛谷档案馆` }))

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.stored_reply_count || 0) / perPage)))
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

// 回复数据异步加载，等目标页的 DOM 出现后再定位，不能只依赖浏览器首次跳锚点。
watch([() => data.value, () => route.hash, recordsPending], async () => {
  if (recordsPending.value || data.value?.page !== currentPage.value || !/^#reply-\d+$/.test(route.hash)) return
  await nextTick()
  contentRef.value?.querySelector(route.hash)?.scrollIntoView({ block: 'center' })
}, { flush: 'post' })
const copied = ref<string | null>(null)
const copyError = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copyTimer))

async function copyMarkdown(key: string, content: string) {
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(content)
    clearTimeout(copyTimer)
    copied.value = key
    copyTimer = setTimeout(() => { copied.value = null }, 1400)
  } catch {
    copyError.value = '复制失败，请检查浏览器的剪贴板权限后重试。'
  }
}

function goPage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  if (recordsPending.value) return
  const query = { ...route.query }
  if (page === 1) delete query.page
  else query.page = String(page)
  void navigateTo({ path: route.path, query })
}
</script>

<template>
  <div ref="contentRef" class="discussion-page">
    <DiscussionControls mode="detail-header" :discussion-id="id" :title="data?.title" :forum-name="data?.forum_name || ''" />
    <SaveButton content-type="discuss" :content-id="String(id)">
      <template #default="{ state, message, save }">
        <DiscussionControls
          mode="detail-toolbar"
          :discussion-id="id"
          :state="state"
          :message="message"
          :updated-at="data?.crawled_at ? smart(data.crawled_at) : ''"
          :copied="copied === 'post'"
          :copy-disabled="!data"
          @update="save"
          @copy="data && copyMarkdown('post', data.content_md)"
          @back="navigateTo('/discuss')"
        />
      </template>
    </SaveButton>
    <p v-if="copyError" class="copy-error" role="alert">{{ copyError }}</p>

    <LoadingPanel v-if="recordsPending && !data" title="正在加载正文与回复" text="" />
    <div v-else-if="error && !data" class="error-box archive-card" role="alert">
      <h2>{{ error.data?.message || '讨论加载失败' }}</h2>
      <p v-if="error.statusCode === 404">{{ error.data?.message ? '可点击更新提交保存任务，或稍后重试读取。' : '尚未读取到归档内容，请稍后重试。' }}</p>
      <DiscussionControls mode="retry" @retry="refresh()" />
    </div>

    <template v-if="data">
      <article class="post-card archive-card">
        <header class="author-row">
          <NuxtLink v-if="data.author" :to="`/user/${data.author.uid}`" class="author-link">
            <img v-if="data.author.avatar" :src="data.author.avatar" alt="" class="avatar" width="32" height="32">
            <LuoguUserName :user="data.author" show-badge no-link />
          </NuxtLink>
          <span v-else>发帖人未收录</span>
          <time v-if="data.source_time" :datetime="data.source_time">{{ format(data.source_time) }}</time>
        </header>
        <div class="post-body lg-content" v-html="render(data.content_md)" />
      </article>

    <section class="reply-section" aria-labelledby="reply-title">
      <header class="reply-head">
        <div>
          <h2 id="reply-title">回复</h2>
          <p>本站已归档 {{ data.stored_reply_count }} 条，源站记录 {{ data.source_reply_count }} 条。</p>
        </div>
        <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      </header>

      <LoadingPanel v-if="recordsPending" title="正在加载回复" text="" />
      <div v-else-if="error" class="error-box archive-card" role="alert">
        <p>{{ error.data?.message || '回复加载失败，请重试。' }}</p>
        <DiscussionControls mode="retry" @retry="refresh()" />
      </div>
      <div v-else-if="data.replies.length" class="reply-list">
        <article
          v-for="reply in data.replies"
          :id="`reply-${reply.reply_id}`"
          :key="reply.reply_id"
          class="reply-item archive-card"
        >
          <header class="reply-meta">
            <NuxtLink v-if="reply.author" :to="`/user/${reply.author.uid}`" class="author-link">
              <img v-if="reply.author.avatar" :src="reply.author.avatar" alt="" class="avatar small" width="28" height="28" loading="lazy">
              <LuoguUserName :user="reply.author" show-badge no-link />
            </NuxtLink>
            <span v-else>用户未收录</span>
            <time v-if="reply.source_time" :datetime="reply.source_time">{{ format(reply.source_time) }}</time>
            <span class="reply-id">#{{ reply.reply_id }}</span>
            <DiscussionControls
              mode="copy"
              class="copy-reply"
              :copied="copied === `reply-${reply.reply_id}`"
              @copy="copyMarkdown(`reply-${reply.reply_id}`, reply.content_md)"
            />
          </header>
          <div class="lg-content reply-body" v-html="render(reply.content_md)" />
        </article>
      </div>
      <p v-else class="empty-replies">本页没有已归档回复。</p>

      <DiscussionControls v-if="totalPages > 1" mode="pagination" :page="currentPage" :total-pages="totalPages" :pending="recordsPending" @page="goPage" />
    </section>
    </template>
  </div>
</template>

<style scoped>
.discussion-page { display: grid; gap: 16px; min-width: 0; }
.post-card { display: block; padding: 0; min-width: 0; overflow: hidden; }
.author-row, .author-link, .reply-meta {
  display: flex;
  align-items: center;
}
.author-row { gap: 8px 14px; flex-wrap: wrap; padding: 14px 20px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
.author-link { gap: 8px; min-width: 0; flex-wrap: wrap; overflow-wrap: anywhere; color: inherit; text-decoration: none; }
.avatar { display: block; width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.avatar.small { width: 28px; height: 28px; }
.copy-reply { width: auto; flex-shrink: 0; }
.post-body { padding: 22px 24px; overflow-wrap: anywhere; }
.reply-section { display: grid; gap: 14px; }
.reply-head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 10px 18px; padding-top: 12px; }
.reply-head h2 { margin: 0; font-size: 18px; font-weight: 600; }
.reply-head p { margin: 5px 0 0; color: var(--text-muted); font-size: 13px; }
.reply-head > span { color: var(--text-muted); font-size: 13px; }
.reply-list { display: grid; gap: 10px; }
.reply-item { display: block; gap: 0; padding: 0; min-width: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: hidden; scroll-margin-top: 24px; }
.reply-meta { min-height: 46px; gap: 8px 12px; flex-wrap: wrap; padding: 9px 16px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 12px; }
.reply-id { margin-left: auto; }
.reply-body { padding: 18px 20px; overflow-wrap: anywhere; }
.reply-body :deep(> :first-child), .post-body :deep(> :first-child) { margin-top: 0; }
.reply-body :deep(> :last-child), .post-body :deep(> :last-child) { margin-bottom: 0; }
.empty-replies, .error-box { padding: 30px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); text-align: center; color: var(--text-muted); }
.error-box h2 { margin: 0; font-size: 18px; color: var(--text); }
.error-box p { margin: 0; }
.copy-error { margin: 0; color: var(--lg-red); font-size: 13px; }
@media (max-width: 720px) {
  .post-body, .reply-body { padding: 16px; }
  .author-row, .reply-meta { padding-inline: 14px; }
  .reply-id { margin-left: 0; }
  .copy-reply { margin-left: auto; }
}
</style>
