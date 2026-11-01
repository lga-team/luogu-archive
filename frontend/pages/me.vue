<script setup lang="ts">
import { Heart, RefreshCw, Settings, UserRound } from 'lucide-vue-next'

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
const error = ref('')

async function load() {
  if (!auth.isLoggedIn) {
    navigateTo('/login')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [followRows, meData] = await Promise.all([
      api<Array<{ uid: number; created_at: string }>>('/follows'),
      api<MeData>('/auth/me'),
    ])
    follows.value = followRows
    me.value = meData
  } catch (e: any) {
    error.value = e?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page page--medium">
    <PageHeader
      title="我的关注"
      description="管理你关注的洛谷用户，最多关注 100 位。"
      eyebrow="My follows"
    >
      <template #icon><Heart :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" @click="navigateTo('/settings')">
          <template #start><Settings :size="16" aria-hidden="true" /></template>账号设置
        </FButton>
      </template>
    </PageHeader>

    <div v-if="auth.isLoggedIn" class="card profile-card">
      <LuoguAvatar
        v-if="me?.luogu_uid"
        :user="{ uid: me.luogu_uid, name: me.display_name }"
        :size="48"
      />
      <FAvatar v-else :name="me?.display_name || auth.displayName" :size="48" />
      <div class="profile-card__main">
        <div class="cluster">
          <strong style="font-size: 17px">{{ me?.display_name || auth.displayName }}</strong>
          <span v-if="me?.luogu_uid" class="tag tag--success">洛谷 UID {{ me.luogu_uid }}</span>
        </div>
        <span class="muted" style="font-size: 13px">
          {{ me?.email || auth.email }} · 已关注 {{ follows.length }} / 100
        </span>
      </div>
      <FButton appearance="subtle" :loading="loading" @click="load">
        <template #start><RefreshCw :size="15" aria-hidden="true" /></template>刷新
      </FButton>
    </div>

    <div v-if="error" class="notice notice--warn" role="alert">
      <span>{{ error }}</span>
      <FButton appearance="subtle" size="small" @click="load">重试</FButton>
    </div>

    <LoadingPanel v-if="loading" variant="list" :rows="4" title="正在加载关注列表" compact />

    <div v-else class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title">关注的用户</h2>
          <p class="card__description">按关注时间倒序排列。</p>
        </div>
        <span class="tag">{{ follows.length }} 位</span>
      </div>
      <EmptyState
        v-if="!follows.length"
        title="还没有关注任何人"
        description="到用户主页点「关注」，就能在这里快速回访。"
      >
        <template #actions>
          <FButton appearance="outline" @click="navigateTo('/discuss')">
            <template #start><UserRound :size="15" aria-hidden="true" /></template>
            去讨论区逛逛
          </FButton>
        </template>
      </EmptyState>
      <div v-else class="list">
        <NuxtLink v-for="f in follows" :key="f.uid" :to="`/user/${f.uid}`" class="list-item list-item-link">
          <LuoguAvatar :user="{ uid: f.uid }" :size="36" />
          <div class="list-item__main">
            <span class="list-item__title">洛谷用户 {{ f.uid }}</span>
            <span class="meta-item muted">关注于 {{ format(f.created_at, 'YYYY-MM-DD HH:mm') }}</span>
          </div>
          <span class="tag">UID {{ f.uid }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; flex-wrap: wrap; }
.profile-card__main { flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.list-item-link { text-decoration: none; color: inherit; }
.list-item-link:hover { text-decoration: none; background: var(--colorNeutralBackground1Hover); }
.list-item-link:hover .list-item__title { color: var(--colorBrandForeground1); }
</style>
