<script setup lang="ts">
import { ChevronRight, Settings } from 'lucide-vue-next'
import { Button } from '~/components/ui'

useHead({ title: '我的关注 - 洛谷档案馆' })

const auth = useAuthStore()
const api = useApi()
const { format } = useTime()

const follows = ref<Array<{ uid: number; created_at: string }>>([])
interface MeData {
  email: string
  display_name: string
  follow_count: number
  luogu_uid: number | null
  luogu_bound_at: string | null
}

const me = ref<MeData | null>(null)
const loading = ref(true)
const loadError = ref(false)

onMounted(async () => {
  if (!auth.isLoggedIn) {
    navigateTo('/settings?mode=login')
    return
  }
  try {
    const [followRows, meData] = await Promise.all([
      api<Array<{ uid: number; created_at: string }>>('/follows'),
      api<MeData>('/auth/me'),
    ])
    follows.value = followRows
    me.value = meData
  } catch (e: any) {
    loadError.value = true
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="archive-ui follows-page">
    <ArchivePageHeader title="我的关注" description="已关注的洛谷用户" icon="follows" />

    <section v-if="auth.isLoggedIn" class="archive-card account-bar" aria-label="账号">
      <div>
        <strong>{{ me?.display_name || auth.displayName }}</strong>
        <p class="archive-muted">{{ me?.email || auth.email }}</p>
      </div>
      <Button as-child variant="outline" size="sm">
        <NuxtLink to="/settings"><Settings :size="15" aria-hidden="true" />账号设置</NuxtLink>
      </Button>
    </section>

    <LoadingPanel v-if="loading" title="正在加载关注列表" text="" />
    <section v-else class="archive-card follows-panel" aria-labelledby="follows-title">
      <div class="follows-heading">
        <h2 id="follows-title">关注列表</h2>
        <span v-if="!loadError" class="archive-muted">{{ follows.length }} / 100</span>
      </div>
      <p v-if="loadError" class="follows-message archive-error" role="alert">关注列表加载失败，请刷新页面重试。</p>
      <ul v-else-if="follows.length" class="follows-list">
        <li v-for="follow in follows" :key="follow.uid">
          <NuxtLink :to="'/user/' + follow.uid" class="follow-row">
            <strong>UID {{ follow.uid }}</strong>
            <time :datetime="follow.created_at">关注于 {{ format(follow.created_at) }}</time>
            <ChevronRight :size="16" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="follows-message archive-muted">还没有关注的用户。</p>
    </section>
  </div>
</template>

<style scoped>
.follows-page { display: grid; gap: 16px; width: min(100%, 1180px); margin-inline: auto; }
.account-bar { flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px 24px; }
.account-bar > div { min-width: 0; overflow-wrap: anywhere; }
.account-bar p { margin: 4px 0 0; }
.follows-panel { gap: 0; padding: 0; }
.follows-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 16px 24px; }
.follows-heading h2 { margin: 0; font-size: 17px; }
.follows-list { margin: 0; padding: 0; list-style: none; }
.follow-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px 12px; padding: 13px 24px; border-top: 1px solid var(--border); color: var(--text); text-decoration: none; }
.follow-row:hover { color: var(--link); background: color-mix(in srgb, var(--link) 5%, transparent); text-decoration: none; }
.follow-row:focus-visible { outline-offset: -3px; }
.follow-row time, .follow-row svg { color: var(--text-muted); }
.follow-row time { font-size: 13px; }
.follows-message { margin: 0; padding: 20px 24px; border-top: 1px solid var(--border); }
@media (max-width: 640px) {
  .account-bar, .follows-heading, .follow-row, .follows-message { padding-inline: 16px; }
  .follow-row { grid-template-columns: minmax(0, 1fr) auto; }
  .follow-row time { grid-row: 2; }
  .follow-row svg { grid-row: 1 / 3; grid-column: 2; }
}
</style>
