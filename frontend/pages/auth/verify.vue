<script setup lang="ts">
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, LogIn, UserPlus } from 'lucide-vue-next'
import { Button } from '~/components/ui'

useHead({ title: '邮箱验证 - 洛谷档案馆' })

// 邮箱验证落地页。用户从邮件里点 {WEB_PUBLIC_ORIGIN}/auth/verify?token=xxx 进来，
// 这里读 token 调后端 /auth/verify 完成验证，再引导去登录。
const route = useRoute()
const api = useApi()

const state = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    state.value = 'error'
    message.value = '验证链接缺少参数，请检查邮件里的完整链接'
    return
  }
  try {
    const resp = await api<{ message: string }>('/auth/verify', {
      query: { token },
    })
    state.value = 'success'
    message.value = resp.message || '邮箱验证成功'
  } catch (e: any) {
    state.value = 'error'
    message.value = e?.data?.message || '验证失败，链接可能已失效'
  }
})
</script>

<template>
  <div class="archive-ui verify-page">
    <ArchivePageHeader title="邮箱验证" description="洛谷档案馆账号邮箱" icon="verify" />

    <section class="archive-card verify-result" :data-state="state" :aria-busy="state === 'loading'">
      <div class="verify-state" :role="state === 'error' ? 'alert' : 'status'">
        <LoaderCircle v-if="state === 'loading'" :size="24" class="settings-spin" aria-hidden="true" />
        <CheckCircle2 v-else-if="state === 'success'" :size="24" aria-hidden="true" />
        <CircleAlert v-else :size="24" aria-hidden="true" />
        <div>
          <h2>{{ state === 'loading' ? '正在验证邮箱' : state === 'success' ? '验证成功' : '验证未成功' }}</h2>
          <p class="archive-muted">{{ state === 'loading' ? '正在确认你的验证链接…' : message }}</p>
        </div>
      </div>
      <div class="verify-actions">
        <Button as-child variant="ghost">
          <NuxtLink to="/"><ArrowLeft :size="16" aria-hidden="true" />返回首页</NuxtLink>
        </Button>
        <Button v-if="state === 'success'" as-child class="verify-primary">
          <NuxtLink to="/settings?mode=login"><LogIn :size="16" aria-hidden="true" />前往登录</NuxtLink>
        </Button>
        <template v-else-if="state === 'error'">
          <Button as-child variant="outline">
            <NuxtLink to="/settings?mode=login"><LogIn :size="16" aria-hidden="true" />去登录页重发</NuxtLink>
          </Button>
          <Button as-child class="verify-primary">
            <NuxtLink to="/settings?mode=register"><UserPlus :size="16" aria-hidden="true" />重新注册</NuxtLink>
          </Button>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.verify-page { display: grid; gap: 16px; width: min(100%, 1180px); margin-inline: auto; }
.verify-result { gap: 18px; padding: 24px; }
.verify-state { display: flex; align-items: flex-start; gap: 12px; }
.verify-state > svg { flex: 0 0 auto; color: var(--link); }
.verify-result[data-state="success"] .verify-state > svg { color: var(--lg-green); }
.verify-result[data-state="error"] .verify-state > svg { color: var(--lg-red); }
.verify-state h2 { margin: 0 0 4px; font-size: 18px; }
.verify-state p { margin: 0; overflow-wrap: anywhere; }
.verify-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 16px; border-top: 1px solid var(--border); }
.archive-ui .verify-primary { background: #0969da; color: #fff; }
.archive-ui .verify-primary:hover { background: #0758b8; color: #fff; }
@media (max-width: 640px) {
  .verify-result { padding: 16px; }
}
</style>
