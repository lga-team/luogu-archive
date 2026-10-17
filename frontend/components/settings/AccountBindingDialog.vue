<script setup lang="ts">
import { Button, Dialog, Input, Label, Textarea } from '../ui'
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
  loading.value = true; text.value = ''; error.value = ''; paste.value = ''; copied.value = false
  clearTimeout(timer)
  try {
    const data = await api<{ verification_text: string }>('/auth/luogu-bind/challenge', { method: 'POST' })
    if (!disposed && current === request) text.value = data.verification_text
  } catch (reason: any) { if (!disposed && current === request) error.value = reason?.data?.message || '生成验证文本失败' }
  finally { if (!disposed && current === request) loading.value = false }
}
async function copy() {
  try { await navigator.clipboard.writeText(text.value); copied.value = true; clearTimeout(timer); timer = setTimeout(() => { copied.value = false }, 1600) }
  catch { error.value = '复制失败，请手动复制验证文本' }
}
async function submit() {
  if (verifying.value || !text.value) return
  if (!paste.value.trim()) { error.value = '请输入剪贴板 ID 或链接'; return }
  verifying.value = true; error.value = ''
  try { await props.verify(paste.value.trim()); if (!disposed) open.value = false }
  catch (reason: any) { if (!disposed) error.value = reason?.data?.message || '验证失败，请检查剪贴板内容和公开状态' }
  finally { if (!disposed) verifying.value = false }
}
</script>
<template>
  <Button @click="changeOpen(true)">绑定账号</Button>
  <Dialog :open="open" title="绑定洛谷账号" description="将验证文本粘贴到该账号的公开剪贴板。" :locked="verifying" @update:open="changeOpen">
    <form class="settings-form" @submit.prevent="submit">
      <p v-if="loading" class="archive-muted" role="status">正在生成验证文本…</p>
      <template v-else-if="text">
        <div class="settings-field"><Label for="settings-bind-text">验证文本</Label><Textarea id="settings-bind-text" :model-value="text" readonly :rows="4" /><div class="settings-copy-actions"><Button variant="outline" @click="copy">{{ copied ? '已复制' : '复制文本' }}</Button><Button as-child variant="ghost"><a href="https://www.luogu.com.cn/paste" target="_blank" rel="noopener noreferrer">新建剪贴板</a></Button></div></div>
        <div class="settings-field"><Label for="settings-paste">剪贴板</Label><Input id="settings-paste" v-model="paste" placeholder="ID、/paste/ID 或完整链接" autocomplete="off" :disabled="verifying" required /></div>
      </template>
      <div v-if="error" role="alert"><p class="archive-error settings-message">{{ error }}</p><Button v-if="!text && !loading" variant="outline" @click="changeOpen(true)">重试</Button></div>
      <div class="archive-dialog-footer"><Button variant="outline" :disabled="verifying" @click="changeOpen(false)">取消</Button><Button type="submit" :disabled="loading || verifying || !text">{{ verifying ? '正在验证…' : '验证并绑定' }}</Button></div>
    </form>
  </Dialog>
</template>
