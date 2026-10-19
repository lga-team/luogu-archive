<script setup lang="ts">
const auth = useAuthStore()
const api = useApi()

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

useHead({ title: '个人中心 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="border-b border-border pb-4">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">个人中心</p>
      <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">我的关注</h1>
    </header>

    <!-- 账号信息卡 -->
    <Card v-if="auth.isLoggedIn" class="mt-5 gap-2 py-4">
      <CardContent class="flex flex-col justify-between gap-3 px-4 sm:flex-row sm:items-center">
        <div class="min-w-0">
          <strong class="text-base">{{ me?.display_name || auth.displayName }}</strong>
          <p class="mt-0.5 text-sm text-muted-foreground">
            登录邮箱：{{ me?.email || auth.email }} · 已关注 {{ follows.length }} / 100
          </p>
        </div>
        <LuoguBindButton
          v-if="me"
          :luogu-uid="me?.luogu_uid ?? null"
          @bound="handleBound"
        />
      </CardContent>
    </Card>

    <!-- 关注列表骨架 -->
    <div v-if="loading" class="mt-5 space-y-2">
      <Skeleton v-for="i in 4" :key="i" class="h-11 rounded-lg" />
    </div>
    <ul v-else-if="follows.length" class="mt-5 list-none space-y-2">
      <li
        v-for="f in follows"
        :key="f.uid"
        class="flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5"
      >
        <NuxtLink
          :to="`/user/${f.uid}`"
          class="font-medium text-foreground transition-colors hover:text-primary"
        >UID {{ f.uid }}</NuxtLink>
        <span class="text-[13px] text-muted-foreground">关注于 {{ f.created_at }}</span>
      </li>
    </ul>
    <p v-else class="mt-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      还没关注任何洛谷用户。到用户主页点「关注」开始吧。
    </p>
  </div>
</template>
