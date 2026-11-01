<script setup lang="ts">
import { CheckCircle2, SearchCheck, ShieldAlert, TriangleAlert } from 'lucide-vue-next'

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
    if (auth.initialized && auth.isLoggedIn && !form.value.requester_email) {
      form.value.requester_email = auth.email
    }
  },
  { immediate: true },
)

const typeNames: Record<string, string> = { user: '用户主页', article: '文章', paste: '剪贴板', feed: '犇犇', discuss: '讨论' }

async function runProbe() {
  const version = ++probeVersion
  const url = form.value.target_url.trim()
  probe.value = null
  message.value = ''
  if (!/^https?:\/\//i.test(url)) return
  probing.value = true
  try {
    const queued: any = await api('/takedown/probe', { method: 'POST', body: { target_url: url } })
    probe.value = queued
    if (queued.status === 'completed') return
    for (let attempt = 0; attempt < 300 && version === probeVersion; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (version !== probeVersion) return
      const current: any = await api(`/takedown/probe/${queued.token}`)
      if (current.status === 'completed') { probe.value = current; return }
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
      body: {
        probe_token: probe.value.token,
        requester_name: form.value.requester_name,
        requester_email: form.value.requester_email || null,
        reason: form.value.reason,
      },
    })
    state.value = 'success'
    message.value = result.auto_approved ? '身份匹配，内容已停止公开展示。' : '申请已提交，等待管理员处理。'
  } catch (e: any) {
    state.value = 'failed'
    message.value = e?.data?.message || '提交失败'
  }
}
</script>

<template>
  <div class="page page--narrow">
    <PageHeader
      title="内容删除申请"
      description="对已无法在原站访问的存档内容，申请停止公开展示。"
      eyebrow="Takedown"
    >
      <template #icon><ShieldAlert :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <div v-if="state === 'success'" class="card">
      <div class="card__body success-block">
        <span class="success-block__icon"><CheckCircle2 :size="30" aria-hidden="true" /></span>
        <h2>申请处理完成</h2>
        <p class="muted">{{ message }}</p>
        <div class="cluster" style="justify-content: center">
          <FButton appearance="primary" @click="navigateTo('/')">返回首页</FButton>
          <FButton appearance="outline" @click="navigateTo('/announcement')">查看公告</FButton>
        </div>
      </div>
    </div>

    <form v-else class="card form-card" @submit.prevent="submit">
      <div class="card__header">
        <div>
          <h2 class="card__title">提交申请</h2>
          <p class="card__description">系统会自动识别内容类型；若原内容仍可访问，需先在原站处理。</p>
        </div>
        <span class="page-header__meta">需要核对</span>
      </div>

      <div class="card__body form">
        <div class="stack stack--xs">
          <label for="takedown-url" class="field-label">内容地址</label>
          <FInput
            id="takedown-url"
            v-model.trim="form.target_url"
            type="url"
            placeholder="粘贴用户主页、文章、剪贴板、犇犇或讨论的完整地址"
            :maxlength="1024"
          />
          <span class="field-help">系统会自动识别内容类型</span>
          <span v-if="probe?.target_type && probe?.target_id" class="recognized">
            识别到：{{ typeNames[probe.target_type] || probe.target_type }}：{{ probe.target_id }}
          </span>
        </div>

        <div v-if="probing" class="notice">
          <span class="skeleton skeleton--inline" aria-hidden="true" />
          <span>正在检查地址…</span>
        </div>
        <div v-else-if="probe && probe.target_type !== 'user'" class="notice" :class="probe.can_submit ? 'notice--brand' : 'notice--warn'">
          <SearchCheck :size="18" aria-hidden="true" />
          <span>
            <strong>{{ probe.accessible ? '可访问' : '不可访问' }}</strong>
            · {{ probe.accessible ? (probe.is_owner ? '已匹配作者身份，可以申请停止公开展示。' : '原内容仍可访问，暂不能提交申请。') : '可以提交删除申请。' }}
          </span>
        </div>
        <div v-else-if="probe" class="notice notice--brand">
          <SearchCheck :size="18" aria-hidden="true" />
          <span><strong>地址有效</strong> · 用户主页申请无需检查原站访问状态。</span>
        </div>

        <template v-if="probe?.can_submit">
          <div v-if="probe.is_owner" class="notice notice--brand">
            <CheckCircle2 :size="18" aria-hidden="true" />
            <span>已匹配绑定的洛谷 UID，提交后将自动停止公开展示。</span>
          </div>
          <div v-else class="form-grid">
            <div class="stack stack--xs">
              <label for="takedown-name" class="field-label">你的称呼（选填）</label>
              <FInput id="takedown-name" v-model="form.requester_name" :maxlength="128" />
            </div>
            <div class="stack stack--xs">
              <label for="takedown-email" class="field-label">联系邮箱（选填）</label>
              <FInput id="takedown-email" v-model.trim="form.requester_email" type="email" autocomplete="email" :maxlength="254" />
            </div>
            <div class="stack stack--xs span-2">
              <label for="takedown-reason" class="field-label">申请理由</label>
              <FTextarea
                id="takedown-reason"
                v-model="form.reason"
                :rows="6"
                :maxlength="5000"
                placeholder="请说明内容关系及停止公开展示的理由"
              />
            </div>
            <p class="field-help span-2">
              自己的内容？<NuxtLink to="/login">登录</NuxtLink>或<NuxtLink to="/register">注册</NuxtLink>并在<NuxtLink to="/settings">设置中绑定洛谷账号</NuxtLink>后，可无条件自动删除。
            </p>
          </div>
        </template>

        <div v-if="message" class="notice notice--warn" role="alert">
          <TriangleAlert :size="18" aria-hidden="true" />
          <span>{{ message }}</span>
        </div>

        <div class="form-actions">
          <FButton type="submit" appearance="primary" :disabled="!probe?.can_submit" :loading="state === 'submitting'">
            {{ state === 'submitting' ? '正在提交…' : '提交申请' }}
          </FButton>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.form-card { overflow: hidden; }
.recognized { color: var(--colorNeutralForeground1); font-weight: 600; font-size: 13px; }
.success-block { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 42px 24px; }
.success-block__icon { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; background: var(--colorPaletteGreenBackground1, #dff6dd); color: var(--colorPaletteGreenForeground1, #0e700e); }
.success-block h2 { font-size: 22px; }
</style>
