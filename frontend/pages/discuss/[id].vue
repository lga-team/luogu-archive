<script setup lang="ts">
import { ArrowLeft, Check, Copy, ExternalLink, MessageSquareReply, RefreshCw } from 'lucide-vue-next'

const route = useRoute()
const api = useApi()
const { format, smart } = useTime()
const id = Number(route.params.id)
definePageMeta({ key: route => route.path })
const perPage = 10
const currentPage = computed(() => Math.max(1, Number.parseInt(String(route.query.page || '1'), 10) || 1))

interface UserBrief {
  uid: number; name: string; color: string; badge: string | null; avatar: string | null
  ccf_level: number; xcpc_level: number; is_admin: boolean
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

const { data, error, status, refresh } = useAsyncData(
  `discussion-${id}`,
  () => api<DiscussionDetail>(`/discuss/${id}`, { query: { page: currentPage.value, per_page: perPage } }),
  { server: true, watch: [currentPage] },
)
const recordsPending = computed(() => status.value === 'idle' || status.value === 'pending')
useHead(() => ({ title: `${data.value?.title || `讨论 #${id}`} - 洛谷档案馆` }))

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.stored_reply_count || 0) / perPage)))
const contentRef = ref<HTMLElement | null>(null)
useCopyCode(contentRef)

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
  <div ref="contentRef" class="page page--medium discuss-detail">
    <PageHeader
      :title="data?.title || '讨论详情'"
      :description="data?.forum_name ? `${data.forum_name} · ${data.stored_reply_count} 条已归档回复` : `讨论 #${id}`"
      eyebrow="Discussion"
    >
      <template #actions>
        <FButton appearance="outline" @click="navigateTo('/discuss')">
          <template #start><ArrowLeft :size="16" aria-hidden="true" /></template>返回列表
        </FButton>
        <FButton appearance="outline" :href="'https://www.luogu.com.cn/discuss/' + id" target="_blank">
          <template #start><ExternalLink :size="15" aria-hidden="true" /></template>查看原站
        </FButton>
        <SaveButton content-type="discuss" :content-id="String(id)">
          <template #default="{ state, message, save }">
            <FButton appearance="primary" :loading="state === 'pending'" @click="save">
              <template #start><RefreshCw v-if="state !== 'pending'" :size="15" aria-hidden="true" /></template>
              {{ state === 'idle' ? '更新' : message || '处理中…' }}
            </FButton>
          </template>
        </SaveButton>
      </template>
    </PageHeader>

    <div class="discuss-detail-grid">
      <div class="stack stack--lg" style="min-width:0">
        <article class="card">
          <LoadingPanel v-if="recordsPending && !data" variant="detail" title="正在加载正文" />
          <div v-else-if="error && !data" class="card__body">
            <EmptyState title="讨论加载失败" :description="(error as any)?.data?.message || '可以提交一次更新，或稍后重试读取。'">
              <template #actions><FButton appearance="outline" @click="refresh()">重试</FButton></template>
            </EmptyState>
          </div>
          <template v-if="data">
            <header class="discuss-post-head">
              <NuxtLink v-if="data.author" :to="`/user/${data.author.uid}`" class="discuss-post-avatar" :aria-label="data.author.name">
                <LuoguAvatar :user="data.author" :size="36" />
              </NuxtLink>
              <div class="stack stack--xs" style="flex:1 1 auto;min-width:0">
                <LuoguUserName v-if="data.author" :user="data.author" show-badge />
                <span v-else class="muted">发帖人未收录</span>
                <span v-if="data.source_time" class="muted" style="font-size: 12px">发表于 {{ format(data.source_time) }}</span>
              </div>
              <FButton appearance="subtle" size="small" :disabled="!data" @click="copyMarkdown('post', data.content_md)">
                <template #start><component :is="copied === 'post' ? Check : Copy" :size="14" aria-hidden="true" /></template>
                {{ copied === 'post' ? '已复制' : '复制原文' }}
              </FButton>
            </header>
            <div class="divider" />
            <MarkdownBody :source="data.content_md" class="markdown-body discuss-post-body" />
          </template>
        </article>

        <section v-if="data" class="reply-section" aria-labelledby="reply-title">
          <div class="section-head">
            <div class="section-head__text">
              <h2 id="reply-title" class="section-title" style="display:flex;align-items:center;gap:8px">
                <MessageSquareReply :size="20" aria-hidden="true" />回复
              </h2>
              <span class="section-subtitle">本站已归档 {{ data.stored_reply_count }} 条，源站记录 {{ data.source_reply_count }} 条</span>
            </div>
            <span class="tag">第 {{ currentPage }} / {{ totalPages }} 页</span>
          </div>

          <LoadingPanel v-if="recordsPending" variant="list" :rows="3" title="正在加载回复" compact />
          <div v-else-if="error" class="card card__body">
            <EmptyState title="回复加载失败" :description="(error as any)?.data?.message || '请稍后重试。'">
              <template #actions><FButton appearance="outline" @click="refresh()">重试</FButton></template>
            </EmptyState>
          </div>
          <div v-else-if="data.replies.length" class="reply-list">
            <article v-for="reply in data.replies" :id="`reply-${reply.reply_id}`" :key="reply.reply_id" class="card reply-item">
              <header class="reply-head">
                <NuxtLink v-if="reply.author" :to="`/user/${reply.author.uid}`" class="discuss-post-avatar" :aria-label="reply.author.name">
                  <LuoguAvatar :user="reply.author" :size="28" />
                </NuxtLink>
                <LuoguUserName v-if="reply.author" :user="reply.author" show-badge />
                <span v-else class="muted">用户未收录</span>
                <time v-if="reply.source_time" class="muted" :datetime="reply.source_time">{{ format(reply.source_time) }}</time>
                <span class="reply-id">#{{ reply.reply_id }}</span>
                <FButton appearance="subtle" size="small" @click="copyMarkdown(`reply-${reply.reply_id}`, reply.content_md)">
                  <template #start><component :is="copied === `reply-${reply.reply_id}` ? Check : Copy" :size="13" aria-hidden="true" /></template>
                  {{ copied === `reply-${reply.reply_id}` ? '已复制' : '复制' }}
                </FButton>
              </header>
              <MarkdownBody :source="reply.content_md" class="markdown-body reply-body" />
            </article>
          </div>
          <EmptyState v-else title="本页没有已归档回复" description="可以切换到其他页，或提交一次更新。" />

          <ArchivePagination v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages" :pending="recordsPending" @page="goPage" />
        </section>
      </div>

      <aside class="discuss-sidebar" aria-label="讨论信息">
        <div class="card">
          <div class="card__header"><h2 class="card__title" style="font-size: 14px">讨论信息</h2></div>
          <div class="card__body">
            <dl class="info-list">
              <div><dt>创建者</dt><dd>
                <NuxtLink v-if="data?.author" :to="`/user/${data.author.uid}`" class="cluster" style="gap:6px">
                  <LuoguAvatar :user="data.author" :size="24" />
                  <LuoguUserName :user="data.author" show-badge no-link />
                </NuxtLink>
                <span v-else>{{ recordsPending ? '—' : '发帖人未收录' }}</span>
              </dd></div>
              <div><dt>发帖时间</dt><dd><time v-if="data?.source_time" :datetime="data.source_time">{{ format(data.source_time) }}</time><span v-else>—</span></dd></div>
              <div><dt>所属版块</dt><dd>{{ data?.forum_name || '—' }}</dd></div>
              <div><dt>上次归档</dt><dd>{{ data?.crawled_at ? smart(data.crawled_at) : '—' }}</dd></div>
            </dl>
          </div>
        </div>
        <p v-if="copyError" class="notice notice--warn" role="alert">{{ copyError }}</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.discuss-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 18px; align-items: start; }
.discuss-sidebar { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
.discuss-post-head { display: flex; align-items: center; gap: 12px; padding: 18px 20px; flex-wrap: wrap; }
.discuss-post-avatar img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: block; }
.discuss-post-body { padding: 18px 20px 24px; }
.reply-section { display: flex; flex-direction: column; gap: 12px; }
.reply-list { display: flex; flex-direction: column; gap: 10px; }
.reply-item { scroll-margin-top: 80px; overflow: hidden; }
.reply-head { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px solid var(--colorNeutralStroke2); font-size: 12px; color: var(--colorNeutralForeground3); }
.reply-head :deep(img) { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.reply-id { margin-left: auto; font-family: var(--fontFamilyMonospace); font-size: 11px; }
.reply-body { padding: 16px; font-size: 14px; }
.reply-body :deep(> :first-child) { margin-top: 0; }
.reply-body :deep(> :last-child) { margin-bottom: 0; }
.info-list { display: flex; flex-direction: column; gap: 12px; margin: 0; font-size: 12px; }
.info-list > div { display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 8px; }
.info-list dt { color: var(--colorNeutralForeground3); }
.info-list dd { margin: 0; color: var(--colorNeutralForeground1); overflow-wrap: anywhere; }
@media (max-width: 1020px) {
  .discuss-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .discuss-sidebar { position: static; }
}
@media (max-width: 680px) {
  .discuss-post-head { padding: 14px; }
  .discuss-post-body { padding: 14px 16px 18px; }
  .reply-id { margin-left: 0; }
  .discuss-post-head > :last-child { width: 100%; }
}
</style>
