<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const auth = useAuthStore()
const api = useApi()
const { copy, copied } = useClipboard({ legacy: true })
const copyFailed = ref(false)
const copying = ref(false)

const follows = ref<Array<{ uid: number; created_at: string }>>([])
interface MeData {
  id: number
  email: string
  display_name: string
  email_verified: boolean
  follow_count: number
  luogu_uid: number | null
  luogu_bound_at: string | null
}

const me = ref<MeData | null>(null)
const loading = ref(true)

async function copyMyInfo() {
  if (!me.value || copying.value) return
  copying.value = true
  copyFailed.value = false
  try {
    const { id, email, display_name, email_verified, follow_count, luogu_uid, luogu_bound_at } = me.value
    await copy(JSON.stringify({ id, email, display_name, email_verified, follow_count, luogu_uid, luogu_bound_at }, null, 2))
  } catch {
    copyFailed.value = true
  } finally {
    copying.value = false
  }
}

function handleBound(uid: number) {
  if (me.value) me.value.luogu_uid = uid
}

onMounted(async () => {
  if (!auth.isLoggedIn) {
    navigateTo('/login')
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
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="me-page">
    <PageHero title="我的关注">
      <template #extra>
        <button
          v-if="auth.isLoggedIn"
          type="button"
          class="copy-info-btn"
          :disabled="!me || copying"
          :aria-busy="copying"
          @click="copyMyInfo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-if="copied && !copyFailed" d="m5 12 4 4L19 6" />
            <template v-else>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </template>
          </svg>
          <span aria-live="polite">{{ copyFailed ? '复制失败，重试' : copied ? '已复制' : '复制我的信息' }}</span>
        </button>
      </template>
    </PageHero>
    <section v-if="auth.isLoggedIn" class="account-bar">
      <div>
        <strong>{{ me?.display_name || auth.displayName }}</strong>
        <p>登录邮箱：{{ me?.email || auth.email }} · 已关注 {{ follows.length }} / 100</p>
      </div>
      <LuoguBindButton
        v-if="me"
        :luogu-uid="me?.luogu_uid ?? null"
        @bound="handleBound"
      />
    </section>

    <div v-if="loading" class="loading">加载中...</div>
    <ul v-else-if="follows.length" class="list">
      <li v-for="f in follows" :key="f.uid">
        <NuxtLink :to="`/user/${f.uid}`">UID {{ f.uid }}</NuxtLink>
        <span class="time">关注于 {{ f.created_at }}</span>
      </li>
    </ul>
    <p v-else class="muted">还没关注任何洛谷用户。到用户主页点「关注」开始吧。</p>
  </div>
</template>

<style scoped>
.me-page :deep(.hero-inner) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.copy-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 156px;
  min-height: 40px;
  margin-left: auto;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.copy-info-btn:hover:not(:disabled) { border-color: var(--link); color: var(--link); }
.copy-info-btn:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; }
.copy-info-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.muted { color: var(--text-muted); }
.account-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
  padding: 15px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.account-bar strong { font-size: 16px; }
.account-bar p { margin: 2px 0 0; color: var(--text-muted); font-size: 14px; }
.loading { padding: 20px; color: var(--text-muted); }
.list {
  list-style: none;
  padding: 0;
}
.list li {
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
}
.time { color: var(--text-muted); font-size: 13px; }
@media (max-width: 620px) {
  .account-bar { align-items: flex-start; flex-direction: column; }
}
</style>
