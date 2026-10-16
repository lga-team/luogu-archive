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
    <section class="post-column" aria-label="讨论主帖">
      <article class="post-card archive-card">
        <DiscussionControls mode="detail-header" :discussion-id="id" :title="data?.title" />
        <LoadingPanel v-if="recordsPending && !data" title="正在加载正文" text="" />
        <div v-else-if="error && !data" class="post-error" role="alert">
          <p>{{ error.data?.message || '讨论加载失败' }}</p>
          <p v-if="error.statusCode === 404">可点击更新提交保存任务，或稍后重试读取。</p>
          <DiscussionControls mode="retry" @retry="refresh()" />
        </div>
        <template v-if="data">
          <header class="author-row">
            <NuxtLink v-if="data.author?.avatar" :to="`/user/${data.author.uid}`" class="author-link" :aria-label="data.author.name">
              <img :src="data.author.avatar" alt="" class="avatar" width="36" height="36">
            </NuxtLink>
            <div class="author-summary">
              <NuxtLink v-if="data.author" :to="`/user/${data.author.uid}`" class="author-link"><LuoguUserName :user="data.author" show-badge no-link /></NuxtLink>
              <span v-else>发帖人未收录</span>
              <time v-if="data.source_time" :datetime="data.source_time">发表于 {{ format(data.source_time) }}</time>
            </div>
          </header>
          <div class="post-body lg-content" v-html="render(data.content_md)" />
        </template>
      </article>
    </section>

    <aside class="detail-sidebar" aria-label="讨论信息与操作">
      <section class="discussion-info archive-card" aria-label="讨论信息">
        <dl>
          <div><dt>创建者</dt><dd>
            <NuxtLink v-if="data?.author" :to="`/user/${data.author.uid}`" class="author-link">
              <img v-if="data.author.avatar" :src="data.author.avatar" alt="" class="avatar small" width="28" height="28">
              <LuoguUserName :user="data.author" show-badge no-link />
            </NuxtLink>
            <span v-else>{{ recordsPending ? '—' : '发帖人未收录' }}</span>
          </dd></div>
          <div><dt>发帖时间</dt><dd><time v-if="data?.source_time" :datetime="data.source_time">{{ format(data.source_time) }}</time><span v-else>—</span></dd></div>
          <div><dt>所属版块</dt><dd>{{ data?.forum_name || '—' }}</dd></div>
        </dl>
      </section>
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
    </aside>

    <section v-if="data" class="reply-section" aria-labelledby="reply-title">
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
  </div>
</template>

<style scoped>
.discussion-page { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); grid-template-areas: 'post sidebar' 'replies sidebar'; align-items: start; gap: 20px 16px; min-width: 0; }
.post-column { grid-area: post; min-width: 0; }
.detail-sidebar { grid-area: sidebar; display: grid; gap: 16px; min-width: 0; position: sticky; top: 18px; }
.post-card { display: block; padding: 22px 24px; min-width: 0; overflow: hidden; }
.discussion-info { display: block; padding: 22px 20px; }
.discussion-info dl { display: grid; gap: 18px; margin: 0; font-size: 14px; }
.discussion-info dl > div { display: grid; grid-template-columns: 74px minmax(0, 1fr); align-items: start; gap: 12px; }
.discussion-info dt { font-weight: 500; color: var(--text); line-height: 1.6; }
.discussion-info dd { display: flex; justify-content: flex-end; margin: 0; min-width: 0; text-align: right; overflow-wrap: anywhere; color: var(--text-muted); line-height: 1.6; }
.discussion-info .author-link { justify-content: flex-end; }
.author-row, .author-link, .reply-meta {
  display: flex;
  align-items: center;
}
.author-row { gap: 10px; flex-wrap: wrap; padding: 16px 0 0; color: var(--text-muted); font-size: 13px; }
.author-summary { display: grid; gap: 4px; min-width: 0; }
.author-summary time { font-size: 12px; }
.author-link { gap: 8px; min-width: 0; flex-wrap: wrap; overflow-wrap: anywhere; color: inherit; text-decoration: none; }
.avatar { display: block; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.avatar.small { width: 28px; height: 28px; }
.copy-reply { width: auto; flex-shrink: 0; }
.post-body { padding: 20px 0 0; overflow-wrap: anywhere; }
.reply-section { grid-area: replies; display: grid; gap: 14px; min-width: 0; }
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
.post-error { display: grid; gap: 12px; padding-top: 20px; color: var(--text-muted); }
.post-error p { margin: 0; }
@media (max-width: 1000px) {
  .discussion-page { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'post' 'sidebar' 'replies'; }
  .detail-sidebar { position: static; }
}
@media (max-width: 720px) {
  .post-card { padding: 18px 16px; }
  .discussion-info { padding: 18px 16px; }
  .reply-body { padding: 16px; }
  .reply-meta { padding-inline: 14px; }
  .reply-id { margin-left: 0; }
  .copy-reply { margin-left: auto; }
}
</style>
