<script setup lang="ts">
import { Download, ShieldAlert } from 'lucide-vue-next'
import type { PluginVersion } from '~/types/plugin'

const props = defineProps<{
  open: boolean
  articleId: string
  pluginName: string
  version: PluginVersion
  action: 'copy' | 'download'
  publicDownload: boolean
}>()
const emit = defineEmits<{ close: []; done: [message: string]; analysis: [] }>()
const api = useApi()
const apiBase = useApiBase()
const { runtimeMode } = usePluginLabels()
const codeBytes = computed(() => props.version.code_bytes)
const copyBlocked = computed(() => props.action === 'copy' && codeBytes.value > 100 * 1024)
const codeSize = computed(() => {
  if (codeBytes.value < 1024 * 1024) return `${Math.ceil(codeBytes.value / 1024)} KiB`
  return `${(codeBytes.value / 1024 / 1024).toFixed(2)} MiB`
})

async function confirm() {
  if (copyBlocked.value) {
    emit('done', '完整代码超过 100 KiB，请下载文件')
    emit('close')
    return
  }
  try {
    const path = `/plugins/${props.articleId}/download/${props.version.id}`
    if (props.action === 'download' && props.publicDownload) {
      const anchor = document.createElement('a')
      anchor.href = `${apiBase}/api/v1${path}`
      anchor.download = props.version.download_filename
      anchor.hidden = true
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      emit('done', '下载已经开始')
      emit('close')
      return
    }
    const codePath = props.action === 'copy' ? `${path}?track_usage=false` : path
    const blob = await api<Blob>(codePath, { responseType: 'blob' })
    if (props.action === 'copy') {
      await navigator.clipboard.writeText(await blob.text())
      try {
        await api(`/plugins/${props.articleId}/increment_copy/${props.version.id}`, { method: 'POST' })
      } catch { /* 统计失败不影响复制 */ }
      emit('done', '代码已复制')
    } else {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = props.version.download_filename
      anchor.click()
      URL.revokeObjectURL(url)
      emit('done', '下载已经开始')
    }
  } catch {
    emit('done', `${props.action === 'copy' ? '复制' : '下载'}失败，请重试`)
  }
  emit('close')
}
</script>

<template>
  <FDialog
    :open="open"
    :title="`确认${action === 'copy' ? '复制' : '下载'}代码`"
    @update:open="!$event && emit('close')"
  >
    <div class="install-dialog">
      <dl class="install-list">
        <div><dt>插件</dt><dd>{{ pluginName }}</dd></div>
        <div><dt>版本</dt><dd>{{ version.version }}</dd></div>
        <div><dt>请求等级</dt><dd><PluginRequestLevelBadge :level="version.final_request_level" compact /></dd></div>
        <div><dt>运行方式</dt><dd>{{ runtimeMode(version.runtime_mode) }}</dd></div>
        <div><dt>最后验证</dt><dd>{{ version.last_verified_on }}</dd></div>
        <div><dt>SHA-256</dt><dd><code class="code-inline">{{ version.code_sha256 }}</code></dd></div>
      </dl>
      <div class="notice notice--warn">
        <ShieldAlert :size="18" aria-hidden="true" />
        <span>代码由上传者提供，本站不会执行或自动验证代码。安装前请阅读请求分析并自行确认风险。</span>
      </div>
      <div v-if="copyBlocked" class="notice notice--warn">
        <span>完整代码大小为 {{ codeSize }}，超过 100 KiB，不能复制，请下载文件。</span>
      </div>
    </div>
    <template #actions>
      <FButton appearance="subtle" @click="emit('analysis')">查看请求分析</FButton>
      <FButton appearance="outline" @click="emit('close')">取消</FButton>
      <FButton appearance="primary" :disabled="copyBlocked" @click="confirm">
        <template #start><Download :size="15" aria-hidden="true" /></template>
        确认{{ action === 'copy' ? '复制' : '下载' }}
      </FButton>
    </template>
  </FDialog>
</template>

<style scoped>
.install-dialog { display: flex; flex-direction: column; gap: 12px; }
.install-list { display: flex; flex-direction: column; gap: 8px; margin: 0; }
.install-list > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; font-size: 13px; }
.install-list dt { color: var(--colorNeutralForeground3); }
.install-list dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 520px) { .install-list > div { grid-template-columns: minmax(0, 1fr); gap: 2px; } }
</style>
