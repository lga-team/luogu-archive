<script setup lang="ts">
import { BookOpenCheck } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const form = reactive({ p_min: 1000, p_max: 16501, b_min: 2001, b_max: 4528, delay_ms: 3000 })
const state = ref<'idle' | 'pending' | 'done' | 'error'>('idle')
const message = ref('')
const totalCount = computed(() => {
  const p = Math.max(0, form.p_max - form.p_min + 1)
  const b = Math.max(0, form.b_max - form.b_min + 1)
  return p + b
})
const etaText = computed(() => {
  const sec = Math.round((totalCount.value * form.delay_ms) / 1000)
  if (sec < 60) return sec + ' 秒'
  if (sec < 3600) return Math.round(sec / 60) + ' 分钟'
  return (sec / 3600).toFixed(1) + ' 小时'
})
async function submit() {
  if (state.value === 'pending') return
  if (!confirm('将派发 ' + totalCount.value + ' 个任务，预计 ' + etaText.value + '。继续？')) return
  state.value = 'pending'
  message.value = '派发中…'
  try {
    const resp = await api<{ message: string; count: number; eta_sec: number }>('/admin/problems/full-refresh', { method: 'POST', body: form })
    state.value = 'done'
    message.value = '已派发 ' + resp.count + ' 条任务，预计 ' + Math.round(resp.eta_sec / 60) + ' 分钟完成'
  } catch (e: any) {
    state.value = 'error'
    message.value = e?.data?.message || '失败'
  }
}
onMounted(() => { if (!admin.isLoggedIn) navigateTo('/admin/login') })
</script>

<template>
  <div class="page page--narrow">
    <PageHeader title="题库全量刷新" description="强制重新检测整个题库的题解开放状态，覆盖关闭后重新开放的题，并发现新增题号。" eyebrow="Problems">
      <template #icon><BookOpenCheck :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <div class="notice">
      洛谷「不允许提交题解」通常是终态，定时巡检不会重扫。使用此功能可以重新检测整个题库。
    </div>

    <div class="card card__body form">
      <div class="range-row">
        <span class="field-label" style="width:110px">P 题号范围</span>
        <FInput v-model.number="form.p_min" type="text" style="width:110px" aria-label="P 最小题号" />
        <span class="muted">~</span>
        <FInput v-model.number="form.p_max" type="text" style="width:110px" aria-label="P 最大题号" />
      </div>
      <div class="range-row">
        <span class="field-label" style="width:110px">B 题号范围</span>
        <FInput v-model.number="form.b_min" type="text" style="width:110px" aria-label="B 最小题号" />
        <span class="muted">~</span>
        <FInput v-model.number="form.b_max" type="text" style="width:110px" aria-label="B 最大题号" />
      </div>
      <div class="range-row">
        <span class="field-label" style="width:110px">任务间隔 (ms)</span>
        <FInput v-model.number="form.delay_ms" type="text" style="width:110px" aria-label="任务间隔" />
        <span class="field-help">越小越快，但可能触发洛谷限流</span>
      </div>

      <div class="summary">
        <span>总任务数：<strong>{{ totalCount }}</strong></span>
        <span>预计耗时：<strong>{{ etaText }}</strong></span>
      </div>

      <div class="form-actions">
        <FButton appearance="primary" size="large" :disabled="state === 'pending' || totalCount === 0" :loading="state === 'pending'" @click="submit">
          {{ state === 'pending' ? '派发中…' : '开始全量刷新' }}
        </FButton>
      </div>
      <div v-if="message" class="notice" :class="state === 'error' ? 'notice--warn' : 'notice--brand'">{{ message }}</div>
    </div>

    <div class="notice notice--warn">
      <div class="stack stack--xs" style="font-size:13px;line-height:1.8">
        <strong>注意事项</strong>
        <span>断号在范围内表现为 404，任务自身会处理（不熔断、不重试）。</span>
        <span>建议间隔 ≥ 3 秒，避免节点被洛谷拦截 5 分钟。</span>
        <span>派发后任务会按错峰队列依次执行，无需关闭页面。</span>
        <span>可以从前台 <NuxtLink to="/problem/list">/problem/list</NuxtLink> 看到结果逐步出现。</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.range-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.summary { display: flex; gap: 28px; flex-wrap: wrap; padding: 12px 14px; border-radius: var(--borderRadiusLarge); background: var(--colorNeutralBackground2); font-size: 13px; }
</style>
