<script setup lang="ts">
const api = useApi()
const auth = useAuthStore()
const form = ref({ target_url: '', requester_name: '', requester_email: '', reason: '' })
const probe = ref<any>(null)
const probing = ref(false)
const state = ref<'idle' | 'submitting' | 'success' | 'failed'>('idle')
const message = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let probeVersion = 0

watch(
  [() => auth.initialized, () => auth.isLoggedIn, () => auth.email],
  () => {
    // 登录态异步恢复后自动带入注册邮箱，但不覆盖用户已经修改的内容。
    if (auth.initialized && auth.isLoggedIn && !form.value.requester_email) {
      form.value.requester_email = auth.email
    }
  },
  { immediate: true },
)

const typeNames: Record<string, string> = {
  user: '用户主页',
  article: '文章',
  paste: '剪贴板',
  feed: '犇犇',
  discuss: '讨论',
}

async function runProbe() {
  const version = ++probeVersion
  const url = form.value.target_url.trim()
  probe.value = null
  message.value = ''
  if (!/^https?:\/\//i.test(url)) return
  probing.value = true
  try {
    const queued: any = await api('/takedown/probe', {
      method: 'POST',
      body: { target_url: url },
    })
    // 地址识别由后端立即完成，耗时的可访问性探测仍在高优先级队列中继续。
    probe.value = queued
    if (queued.status === 'completed') {
      return
    }
    for (let attempt = 0; attempt < 300 && version === probeVersion; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (version !== probeVersion) return
      const current: any = await api(`/takedown/probe/${queued.token}`)
      if (current.status === 'completed') {
        probe.value = current
        return
      }
    }
    if (version === probeVersion) message.value = '地址检查超时，请稍后重试'
  } catch (e: any) {
    if (version === probeVersion) message.value = e?.data?.message || '地址检查失败'
  } finally {
    if (version === probeVersion) probing.value = false
  }
}

watch(() => form.value.target_url, () => {
  probeVersion += 1
  clearTimeout(timer)
  probe.value = null
  timer = setTimeout(runProbe, 600)
})

async function submit() {
  if (!probe.value?.can_submit) return
  if (!probe.value.is_owner && form.value.reason.trim().length < 10) {
    message.value = '请填写至少 10 个字的申请理由'
    return
  }
  state.value = 'submitting'
  try {
    const result: any = await api('/takedown', {
      method: 'POST',
      body: { probe_token: probe.value.token, requester_name: form.value.requester_name,
        requester_email: form.value.requester_email || null,
        reason: form.value.reason },
    })
    state.value = 'success'
    message.value = result.auto_approved ? '身份匹配，内容已停止公开展示。' : '申请已提交，等待管理员处理。'
  } catch (e: any) {
    state.value = 'failed'
    message.value = e?.data?.message || '提交失败'
  }
}

// 探测结果条：绿 = 可提交 / 地址有效，红 = 原内容仍可访问
const probeState = computed(() => {
  if (!probe.value) return null
  const accessible = probe.value.accessible
  const owner = probe.value.is_owner
  const blocked = probe.value.target_type !== 'user' && accessible && !owner
  return {
    blocked,
    title: probe.value.target_type !== 'user' ? (accessible ? '可访问' : '不可访问') : '地址有效',
    text: probe.value.target_type !== 'user'
      ? (accessible ? (owner ? '已匹配作者身份，可以申请停止公开展示。' : '原内容仍可访问，暂不能提交申请。') : '可以提交删除申请。')
      : '用户主页申请无需检查原站访问状态。',
    cls: blocked
      ? 'border-[var(--lg-red)] bg-[color-mix(in_srgb,var(--lg-red)_8%,var(--card))]'
      : 'border-[var(--lg-green)] bg-[color-mix(in_srgb,var(--lg-green)_9%,var(--card))]',
  }
})

useHead({ title: '内容删除申请 - 洛谷档案馆' })

</script>

<template>
  <div class="mx-auto w-full max-w-[860px]">
    <!-- 页面头：裸排 + border-b -->
    <header class="border-b border-border pb-4">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">自助服务</p>
      <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">内容删除申请</h1>
      <p class="mt-1 text-sm text-muted-foreground">对已无法在原站访问的存档内容申请停止公开展示。</p>
    </header>

    <!-- 提交成功 -->
    <div
      v-if="state === 'success'"
      class="mt-5 rounded-xl border border-[var(--lg-green)] bg-[color-mix(in_srgb,var(--lg-green)_9%,var(--card))] p-10 text-center"
    >
      <h2 class="text-lg font-semibold text-[var(--lg-green)]">申请处理完成</h2>
      <p class="mt-1 text-sm text-muted-foreground">{{ message }}</p>
    </div>

    <form v-else class="mt-5 space-y-5" @submit.prevent="submit">
      <!-- 内容地址 -->
      <Card class="gap-4 py-5">
        <CardHeader class="px-5">
          <CardTitle class="text-base">内容地址</CardTitle>
          <CardDescription class="text-sm">粘贴内容完整地址，系统会自动识别内容类型。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3 px-5">
          <Input
            v-model.trim="form.target_url"
            type="url"
            placeholder="粘贴用户主页、文章、剪贴板、犇犇或讨论的完整地址"
            maxlength="1024"
            class="h-12 text-base"
          />
          <span v-if="probe?.target_type && probe?.target_id" class="block text-sm font-semibold">
            识别到：{{ typeNames[probe.target_type] || probe.target_type }}：{{ probe.target_id }}
          </span>
          <div
            v-if="probing"
            class="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground"
          >检查中……</div>
          <div
            v-else-if="probeState"
            class="flex flex-col items-start gap-1 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
            :class="probeState.cls"
          >
            <strong class="text-sm">{{ probeState.title }}</strong>
            <span class="text-sm text-muted-foreground">{{ probeState.text }}</span>
          </div>
          <p
            v-else-if="message"
            class="text-sm text-[var(--lg-red)]"
          >{{ message }}</p>
        </CardContent>
      </Card>

      <!-- 申请信息 -->
      <Card v-if="probe?.can_submit" class="gap-4 py-5">
        <CardHeader class="px-5">
          <CardTitle class="text-base">申请人信息</CardTitle>
          <CardDescription class="text-sm">
            {{ probe.is_owner ? '已匹配绑定的洛谷 UID，提交后将自动停止公开展示。' : '留下身份信息便于管理员联系核实。' }}
          </CardDescription>
        </CardHeader>
        <CardContent v-if="!probe.is_owner" class="space-y-4 px-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-semibold" for="td-name">你的称呼（选填）</label>
              <Input id="td-name" v-model="form.requester_name" maxlength="128" class="h-10" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold" for="td-email">联系邮箱（选填）</label>
              <Input
                id="td-email"
                v-model.trim="form.requester_email"
                type="email"
                autocomplete="email"
                maxlength="254"
                class="h-10"
              />
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="td-reason">申请理由</label>
            <Textarea
              id="td-reason"
              v-model="form.reason"
              rows="6"
              maxlength="5000"
              placeholder="请说明内容关系及停止公开展示的理由"
              class="min-h-32"
            />
          </div>
          <p class="text-sm text-muted-foreground">
            自己的内容？<NuxtLink to="/login" class="font-medium text-foreground underline-offset-2 hover:underline">登录</NuxtLink>或<NuxtLink to="/register" class="font-medium text-foreground underline-offset-2 hover:underline">注册</NuxtLink>并在<NuxtLink to="/me" class="font-medium text-foreground underline-offset-2 hover:underline">个人中心绑定洛谷账号</NuxtLink>后，可无条件自动删除。
          </p>
        </CardContent>
        <CardFooter class="justify-end gap-3 px-5">
          <p v-if="message" class="mr-auto text-sm text-[var(--lg-red)]">{{ message }}</p>
          <Button type="submit" :disabled="state === 'submitting'">
            {{ state === 'submitting' ? '提交中……' : '提交申请' }}
          </Button>
        </CardFooter>
      </Card>
    </form>
  </div>
</template>
