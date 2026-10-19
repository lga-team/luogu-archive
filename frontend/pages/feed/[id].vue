<script setup lang="ts">
interface FeedItem {
  id: number
  type: number
  time: string
  content_md: string
  merged_suffix_md: string | null
  merged_from_id: number | null
  merged_link_md?: string[]
  merged_image_md?: string[]
  user: { uid: number; name: string; color: string; badge: string | null; avatar: string | null } | null
}

const route = useRoute()
const api = useApi()
const { smart } = useTime()
const { feedHtml } = useFeedContent()

const contentRef = ref<HTMLElement | null>(null)

const { data: feed, pending, error, refresh } = useLazyAsyncData(
  `feed-${route.params.id}`,
  () => api<FeedItem>(`/feed/${route.params.id}`),
  { server: false },
)

useHead(() => ({ title: feed.value?.user?.name ? `${feed.value.user.name} - 洛谷档案馆` : '犇犇 - 洛谷档案馆' }))

useCopyCode(contentRef)
</script>

<template>
  <div class="pt-1">
    <div v-if="pending" class="flex gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <Skeleton class="size-10 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1 space-y-2.5">
        <Skeleton class="h-4 w-40" />
        <Skeleton class="h-3.5 w-full max-w-[85%]" />
        <Skeleton class="h-3.5 w-full max-w-[60%]" />
      </div>
    </div>

    <NotArchivedNotice
      v-else-if="error"
      :title="error.data?.message || '犇犇加载失败'"
      @retry="refresh()"
    >
      <Button variant="ghost" size="sm" @click="navigateTo('/feed')">返回犇犇列表</Button>
    </NotArchivedNotice>

    <article v-else-if="feed" class="flex gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <NuxtLink :to="feed.user ? `/user/${feed.user.uid}` : ''" class="shrink-0" :class="{ 'pointer-events-none': !feed.user }">
        <UserAvatar :user="feed.user" size="xl" />
      </NuxtLink>

      <div class="min-w-0 flex-1 [overflow-wrap:anywhere] [&_a]:break-all">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <LuoguUserName :user="feed.user" show-badge truncate />
          <time class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ smart(feed.time) }}</time>
        </div>
        <div
          ref="contentRef"
          class="lg-content mt-2 [overflow-wrap:anywhere]"
          v-html="feedHtml(feed)"
        />
        <div class="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <span class="tabular-nums">#{{ feed.id }}</span>
          <FeedReplyButton :content="feed.content_md" :sender-name="feed.user?.name" />
        </div>
      </div>
    </article>
  </div>
</template>
