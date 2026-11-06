<script setup lang="ts">
import { Copy, Download, LoaderCircle, ShieldCheck } from 'lucide-vue-next'
import { Button, Dialog } from '~/components/ui'
import type { PluginVersion } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'

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
const config = useRuntimeConfig()
const { runtimeMode } = usePluginLabels()
const busy = ref(false)
const errorText = ref('')
const codeBytes = computed(() => props.version.code_bytes)
const copyBlocked = computed(() => props.action === 'copy' && codeBytes.value > PLUGIN_CODE_COPY_MAX_BYTES)
const codeSize = computed(() => {
  if (codeBytes.value < 1024 * 1024) return `${Math.ceil(codeBytes.value / 1024)} KiB`
  return `${(codeBytes.value / 1024 / 1024).toFixed(2)} MiB`
})

async function confirm() {
  if (busy.value) return
  if (copyBlocked.value) {
    emit('done', '完整代码超过 100 KiB，请下载文件')
    emit('close')
    return
  }
  busy.value = true
  errorText.value = ''
  try {
    const path = `/plugins/${props.articleId}/download/${props.version.id}`

    // 公开下载由真实文件请求在后端记数，不再依赖可绕过的客户端累计接口。
    if (props.action === 'download' && props.publicDownload) {
      const base = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
      const anchor = document.createElement('a')
      anchor.href = `${base}/api/v1${path}`
      anchor.download = props.version.download_filename
      anchor.hidden = true
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      emit('done', '下载已经开始')
      emit('close')
      return
    }

    // 复制只在剪贴板写入成功后上报，读取代码本身不应被算作下载。
    const codePath = props.action === 'copy' ? `${path}?track_usage=false` : path
    const blob = await api<Blob>(codePath, { responseType: 'blob' })
    if (props.action === 'copy') {
      await navigator.clipboard.writeText(await blob.text())
      try {
        await api(`/plugins/${props.articleId}/increment_copy/${props.version.id}`, { method: 'POST' })
      } catch (e) {
        // 统计失败不能影响已经完成的复制操作。
      }
      emit('done', '代码已复制')
    } else {
      // 非公开下载已经在读取文件时由后端完成记数。
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = props.version.download_filename
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      emit('done', '下载已经开始')
    }
  } catch {
    errorText.value = `${props.action === 'copy' ? '复制' : '下载'}失败，请检查网络${props.action === 'copy' ? '及剪贴板权限' : ''}后重试。`
    return
  } finally {
    busy.value = false
  }
  emit('close')
}
watch(() => props.open, () => { errorText.value = '' })
</script>

<template>
  <Dialog :open="open" :title="'确认' + (action === 'copy' ? '复制' : '下载') + '代码'" description="代码由上传者提供，本站不会执行或自动验证代码。请先确认请求等级与运行方式。" content-class="plugin-install-dialog" overlay-class="plugin-install-overlay" :locked="busy" @update:open="!$event && emit('close')">
    <dl class="plugin-install-details">
      <div><dt>插件</dt><dd>{{ pluginName }}</dd></div>
      <div><dt>版本</dt><dd>v{{ version.version }}</dd></div>
      <div><dt>请求等级</dt><dd><PluginRequestLevelBadge :level="version.final_request_level" compact /></dd></div>
      <div><dt>运行方式</dt><dd>{{ runtimeMode(version.runtime_mode) }}</dd></div>
      <div><dt>最后验证</dt><dd>{{ version.last_verified_on || '未注明' }}</dd></div>
      <div><dt>文件大小</dt><dd>{{ codeSize }}</dd></div>
    </dl>
    <details class="plugin-install-technical"><summary>SHA-256</summary><code>{{ version.code_sha256 }}</code></details>
    <p v-if="copyBlocked" class="plugin-install-error" role="alert">完整代码超过 100 KiB，不能复制，请下载文件。</p>
    <p v-if="errorText" class="plugin-install-error" role="alert">{{ errorText }}</p>
    <template #footer>
      <Button size="sm" variant="ghost" class="plugin-install-analysis" :disabled="busy" @click="emit('analysis')"><ShieldCheck :size="14" aria-hidden="true" />请求分析</Button>
      <Button size="sm" variant="outline" :disabled="busy" @click="emit('close')">取消</Button>
      <Button size="sm" class="plugin-install-confirm" :disabled="copyBlocked || busy" @click="confirm"><LoaderCircle v-if="busy" :size="14" class="plugin-install-spinner" aria-hidden="true" /><Copy v-else-if="action === 'copy'" :size="14" aria-hidden="true" /><Download v-else :size="14" aria-hidden="true" />{{ busy ? '正在处理…' : action === 'copy' ? '确认复制' : '确认下载' }}</Button>
    </template>
  </Dialog>
</template>

<style scoped>
/* 根节点负责锁滚动，body 不再成为 sticky 的额外滚动容器。 */
:global(html:has(.plugin-install-overlay)) { scrollbar-gutter: stable; overflow-y: hidden; }
:global(body:has(.plugin-install-overlay)) { overflow: visible !important; padding-right: 0 !important; margin-right: 0 !important; }
:global(.plugin-install-overlay[data-state=open]) { animation: plugin-overlay-in 160ms ease-out both; }
:global(.plugin-install-overlay[data-state=closed]) { animation: plugin-overlay-out 120ms ease-in both; }
:global(.plugin-install-dialog[data-state=open]) { animation: plugin-dialog-in 180ms cubic-bezier(.16, 1, .3, 1) both; }
:global(.plugin-install-dialog[data-state=closed]) { animation: plugin-dialog-out 120ms ease-in both; pointer-events: none; }
@keyframes plugin-overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes plugin-overlay-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes plugin-dialog-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 6px)) scale(.97); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes plugin-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, calc(-50% + 4px)) scale(.98); } }
.plugin-install-details { display: grid; gap: 14px; margin: 0; font-size: 14px; }
.plugin-install-details > div { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 12px; align-items: start; }
.plugin-install-details dt { color: var(--text-muted); font-size: 13px; }
.plugin-install-details dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.plugin-install-technical { padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
.plugin-install-technical summary { cursor: pointer; }
.plugin-install-technical code { display: block; margin-top: 10px; overflow-wrap: anywhere; font-size: 11px; }
.plugin-install-error { margin: 0; color: var(--lg-red); font-size: 13px; line-height: 1.6; }
.plugin-install-analysis { margin-right: auto; }
.archive-ui .plugin-install-confirm { background: var(--link); color: #fff; min-width: 108px; }
.archive-ui .plugin-install-confirm:hover { background: color-mix(in srgb, var(--link) 88%, #000); color: #fff; }
.plugin-install-spinner { animation: plugin-install-spin 1s linear infinite; }
@keyframes plugin-install-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .plugin-install-spinner { animation: none; } :global(.plugin-install-overlay[data-state]), :global(.plugin-install-dialog[data-state]) { animation: none; } }
@media (max-width: 420px) { .plugin-install-details > div { grid-template-columns: 64px minmax(0, 1fr); gap: 8px; } .plugin-install-analysis { margin-right: 0; } }
</style>
