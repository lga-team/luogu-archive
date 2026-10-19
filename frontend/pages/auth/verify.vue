<script setup lang="ts">
// 邮箱验证落地页。用户从邮件里点 {WEB_PUBLIC_ORIGIN}/auth/verify?token=xxx 进来，
// 这里读 token 调后端 /auth/verify 完成验证，再引导去登录。
import { Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'

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

useHead({ title: '邮箱验证 - 洛谷档案馆' })

</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-4 py-10">
    <div class="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-card px-8 pb-7 pt-10 text-center shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-400">
      <!-- 顶部色条随状态变化 -->
      <div
        class="absolute inset-x-0 top-0 h-1"
        :class="state === 'success' ? 'bg-[var(--lg-green)]' : state === 'error' ? 'bg-[var(--lg-red)]' : 'bg-primary'"
      />

      <!-- 状态图标 -->
      <div class="mb-4 flex h-[84px] items-center justify-center">
        <Loader2 v-if="state === 'loading'" class="size-13 animate-spin text-primary" aria-label="验证中" />

        <!-- success：对勾，带描边动画 -->
        <svg v-else-if="state === 'success'" class="status-svg" viewBox="0 0 52 52">
          <circle class="draw-circle stroke-[var(--lg-green)]" cx="26" cy="26" r="24" fill="none" />
          <path class="draw-mark stroke-[var(--lg-green)]" fill="none" d="M14 27l8 8 16-16" />
        </svg>

        <!-- error：叉，带描边动画 -->
        <svg v-else class="status-svg" viewBox="0 0 52 52">
          <circle class="draw-circle stroke-[var(--lg-red)]" cx="26" cy="26" r="24" fill="none" />
          <path class="draw-mark stroke-[var(--lg-red)]" fill="none" d="M18 18l16 16M34 18L18 34" />
        </svg>
      </div>

      <h1 class="mb-2 text-[22px] font-bold">
        <template v-if="state === 'loading'">正在验证邮箱</template>
        <template v-else-if="state === 'success'">验证成功</template>
        <template v-else>验证未成功</template>
      </h1>

      <p class="mb-6 text-[15px] leading-relaxed text-muted-foreground">
        <template v-if="state === 'loading'">请稍候，正在确认你的验证链接…</template>
        <template v-else>{{ message }}</template>
      </p>

      <div class="mb-4 flex flex-wrap justify-center gap-2.5">
        <Button v-if="state === 'success'" as-child>
          <NuxtLink to="/login">前往登录</NuxtLink>
        </Button>
        <template v-else-if="state === 'error'">
          <Button variant="outline" as-child>
            <NuxtLink to="/login">去登录页重发</NuxtLink>
          </Button>
          <Button as-child>
            <NuxtLink to="/register">重新注册</NuxtLink>
          </Button>
        </template>
      </div>

      <NuxtLink to="/" class="text-[13px] text-muted-foreground transition-colors hover:text-primary">返回首页</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* SVG 描边动画 */
.status-svg { width: 84px; height: 84px; }
.draw-circle {
  stroke-width: 3;
  stroke-dasharray: 151;
  stroke-dashoffset: 151;
  animation: draw-circle 0.5s ease forwards;
}
.draw-mark {
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: draw-mark 0.4s 0.4s ease forwards;
}
@keyframes draw-circle { to { stroke-dashoffset: 0; } }
@keyframes draw-mark { to { stroke-dashoffset: 0; } }
</style>
