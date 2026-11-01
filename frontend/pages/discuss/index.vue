<script setup lang="ts">
import { MessagesSquare, RefreshCw } from 'lucide-vue-next'

const api = useApi()
const { format, smart } = useTime()
useHead({ title: '讨论区 - 洛谷档案馆' })
const page = ref(1)
const selectedForum = ref('')
const pageSize = 30

interface UserBrief {
  uid: number; name: string; color: string; badge: string | null; avatar: string | null
  ccf_level: number; xcpc_level: number; is_admin: boolean
}
interface ForumItem { name: string; slug: string; count: number }
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
    query: { page: page.value, page_size: pageSize, forum: selectedForum.value || undefined },
  }),
  { server: false, watch: [page, selectedForum] },
)
const recordsPending = computed(() => status.value === 'idle' || status.value === 'pending')
const { data: lastCrawled } = useLazyAsyncData(
  'discussion-last-crawled',
  () => api<{ last_crawled_at: string | null }>('/last-crawled', { query: { type: 'discovery_discuss' } }),
  { server: false },
)
const totalPages = computed(() => Math.min(20, Math.max(1, Math.ceil((data.value?.total || 0) / pageSize))))
function chooseForum(slug: string) {
  if (selectedForum.value === slug) return
  selectedForum.value = slug
  page.value = 1
}
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="讨论"
      description="洛谷讨论区的公开内容与历史版本，按最新回复时间归档。"
      eyebrow="Discuss"
    >
      <template #icon><MessagesSquare :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #meta>
        <span v-if="lastCrawled?.last_crawled_at" class="meta-item">
          <RefreshCw :size="13" aria-hidden="true" />上次抓取 {{ smart(lastCrawled.last_crawled_at) }}
        </span>
      </template>
      <template #actions>
        <SaveButton content-type="discuss_list" content-id="all">
          <template #default="{ state, message, save }">
            <FButton appearance="outline" :loading="state === 'pending'" @click="save">
              <template #start><RefreshCw v-if="state !== 'pending'" :size="15" aria-hidden="true" /></template>
              {{ state === 'idle' ? '更新列表' : message || '处理中…' }}
            </FButton>
          </template>
        </SaveButton>
      </template>
    </PageHeader>

    <div class="discuss-layout">
      <aside class="forum-panel" aria-label="讨论版块">
        <div class="card">
          <div class="card__header" style="padding: 14px 16px">
            <h2 class="card__title" style="font-size: 14px">版块</h2>
          </div>
          <div class="forum-list">
            <button
              type="button"
              class="forum-item"
              :class="{ 'is-active': !selectedForum }"
              @click="chooseForum('')"
            >
              <span>全部讨论</span>
              <span class="tag">{{ data?.total ?? '—' }}</span>
            </button>
            <button
              v-for="forum in data?.forums || []"
              :key="forum.slug"
              type="button"
              class="forum-item"
              :class="{ 'is-active': selectedForum === forum.slug }"
              @click="chooseForum(forum.slug)"
            >
              <span>{{ forum.name }}</span>
              <span class="tag">{{ forum.count }}</span>
            </button>
          </div>
        </div>
      </aside>

      <section class="discuss-main" aria-label="已归档讨论" :aria-busy="recordsPending">
        <LoadingPanel v-if="recordsPending" variant="list" :rows="6" title="正在加载讨论" />

        <div v-else-if="error" class="card card__body">
          <EmptyState title="讨论列表加载失败" :description="(error as any)?.data?.message || '请稍后重试。'">
            <template #actions>
              <FButton appearance="outline" @click="refreshList()">重试</FButton>
            </template>
          </EmptyState>
        </div>

        <div v-else class="card">
          <EmptyState
            v-if="!data?.items.length"
            title="这个版块暂时没有已归档讨论"
            description="可以提交一次更新，或切换到其他版块看看。"
          />
          <div v-else class="list">
            <NuxtLink
              v-for="item in data.items"
              :key="item.discussion_id"
              :to="`/discuss/${item.discussion_id}`"
              class="discuss-row"
            >
              <div class="discuss-row__avatar">
                <LuoguAvatar :user="item.author" :size="34" />
              </div>
              <div class="discuss-row__main">
                <span class="discuss-row__title">{{ item.title }}</span>
                <div class="meta-row">
                  <LuoguUserName v-if="item.author" :user="item.author" show-badge />
                  <span v-else class="muted">发帖人未收录</span>
                  <time :datetime="item.source_time || item.crawled_at">{{ format(item.source_time || item.crawled_at) }}</time>
                </div>
              </div>
              <div class="discuss-row__aside">
                <span class="tag tag--brand">{{ item.forum_name || '未知版块' }}</span>
                <span class="meta-item muted">{{ item.stored_reply_count }} 条回复</span>
                <span v-if="item.latest_reply_time" class="meta-item muted">最近 {{ format(item.latest_reply_time) }}</span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <ArchivePagination
          v-if="!error && totalPages > 1"
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
.discuss-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: start; }
.forum-panel { position: sticky; top: 16px; }
.forum-list { display: flex; flex-direction: column; padding: 6px; max-height: calc(100dvh - 180px); overflow-y: auto; }
.forum-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; padding: 8px 10px; border: 0; border-radius: var(--borderRadiusMedium);
  background: transparent; color: var(--colorNeutralForeground2);
  font-size: 13px; text-align: left; cursor: pointer;
}
.forum-item:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorNeutralForeground1); }
.forum-item.is-active { background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-weight: 600; }
.discuss-main { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.discuss-row {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid var(--colorNeutralStroke2);
  color: inherit; text-decoration: none; min-width: 0;
  transition: background var(--app-transition);
}
.discuss-row:last-child { border-bottom: 0; }
.discuss-row:hover { background: var(--colorNeutralBackground1Hover); text-decoration: none; }
.discuss-row__avatar { flex-shrink: 0; }
.discuss-row__avatar img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; display: block; }
.discuss-row__main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.discuss-row__title { font-weight: 600; font-size: 14.5px; line-height: 1.45; color: var(--colorNeutralForeground1); overflow-wrap: anywhere; }
.discuss-row:hover .discuss-row__title { color: var(--colorBrandForeground1); }
.discuss-row__aside { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 11px; }
@media (max-width: 980px) {
  .discuss-layout { grid-template-columns: minmax(0, 1fr); }
  .forum-panel { position: static; }
  .forum-list { flex-direction: row; overflow-x: auto; }
  .forum-item { width: auto; white-space: nowrap; }
}
@media (max-width: 680px) {
  .discuss-row { padding: 12px 14px; gap: 10px; align-items: flex-start; }
  .discuss-row__aside { display: none; }
}
</style>
