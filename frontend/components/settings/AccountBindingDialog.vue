<script setup lang="ts">
import { Check, Copy, ExternalLink, Link2, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{ verify: (pasteId: string) => Promise<void> }>()
const api = useApi()
const open = ref(false)
const text = ref('')
const paste = ref('')
const error = ref('')
const loading = ref(false)
const verifying = ref(false)
const copied = ref(false)
let request = 0
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => { disposed = true; request++; clearTimeout(timer) })

async function changeOpen(value: boolean) {
  if (verifying.value) return
  const current = ++request
  open.value = value
  if (!value) return
  loading.value = true
  text.value = ''
  error.value = ''
  paste.value = ''
  copied.value = false
  clearTimeout(timer)
  try {
    const data = await api<{ verification_text: string }>('/auth/luogu-bind/challenge', { method: 'POST' })
    if (!disposed && current === request) text.value = data.verification_text
  } catch (reason: any) {
    if (!disposed && current === request) error.value = reason?.data?.message || '生成验证文本失败'
  } finally {
    if (!disposed && current === request) loading.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 1600)
  } catch {
    error.value = '复制失败，请手动复制验证文本'
  }
}

async function submit() {
  if (verifying.value || !text.value) return
  if (!paste.value.trim()) { error.value = '请输入剪贴板 ID 或链接'; return }
  verifying.value = true
  error.value = ''
  try {
    await props.verify(paste.value.trim())
    if (!disposed) open.value = false
  } catch (reason: any) {
    if (!disposed) error.value = reason?.data?.message || '验证失败，请检查剪贴板内容和公开状态'
  } finally {
    if (!disposed) verifying.value = false
  }
}
</script>

<template>
  <FButton appearance="primary" @click="changeOpen(true)">
    <template #start><Link2 :size="16" aria-hidden="true" /></template>
    绑定洛谷账号
  </FButton>

  <FDialog :open="open" title="绑定洛谷账号" @update:open="changeOpen">
    <form class="dialog-form" @submit.prevent="submit">
      <div class="notice notice--brand">
        <ShieldCheck :size="18" aria-hidden="true" />
        <span>在洛谷创建一个<strong>公开</strong>剪贴板，把下面的验证文本粘贴进去，然后填写剪贴板编号。</span>
      </div>

      <LoadingPanel v-if="loading" compact title="正在生成验证文本" />

      <template v-else-if="text">
        <div class="stack stack--xs">
          <span class="field-label">验证文本</span>
          <pre class="bind-text">{{ text }}</pre>
          <div class="cluster">
            <FButton appearance="outline" size="small" @click="copy">
              <template #start><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" /></template>
              {{ copied ? '已复制' : '复制文本' }}
            </FButton>
            <FButton
              appearance="subtle"
              size="small"
              href="https://www.luogu.com.cn/paste"
              target="_blank"
            >
              <template #end><ExternalLink :size="14" aria-hidden="true" /></template>
              新建剪贴板
            </FButton>
          </div>
        </div>

        <div class="stack stack--xs">
          <label for="bind-paste" class="field-label">剪贴板编号</label>
          <FInput
            id="bind-paste"
            v-model="paste"
            placeholder="ID、/paste/ID 或完整链接"
            autocomplete="off"
            :disabled="verifying"
            required
            @enter="submit"
          />
        </div>
      </template>

      <div v-if="error" class="notice notice--warn" role="alert">
        <span>{{ error }}</span>
        <FButton v-if="!text && !loading" appearance="subtle" size="small" @click="changeOpen(true)">重试</FButton>
      </div>

      <div class="app-dialog__actions">
        <FButton appearance="outline" :disabled="verifying" @click="changeOpen(false)">取消</FButton>
        <FButton type="submit" appearance="primary" :loading="verifying" :disabled="loading || !text">
          {{ verifying ? '正在验证…' : '验证并绑定' }}
        </FButton>
      </div>
    </form>
  </FDialog>
</template>

<style scoped>
.bind-text {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--borderRadiusMedium);
  border: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground3);
  font-family: var(--fontFamilyMonospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
}
</style>
