<script setup lang="ts">
import type { PluginVersion } from '~/types/plugin'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  <Dialog :open="open" @update:open="(v: boolean) => !v && emit('close')">
    <DialogContent class="max-w-[620px] gap-0 p-0">
      <DialogHeader class="border-b border-border px-5 py-4">
        <DialogTitle class="text-lg">确认{{ action === 'copy' ? '复制' : '下载' }}代码</DialogTitle>
        <DialogDescription class="sr-only">
          确认{{ action === 'copy' ? '复制' : '下载' }}插件代码
        </DialogDescription>
      </DialogHeader>

      <dl class="grid gap-2.5 px-5 py-4">
        <div v-for="row in [
          { label: '插件', slot: 'name' },
          { label: '版本', slot: 'version' },
          { label: '请求等级', slot: 'level' },
          { label: '运行方式', slot: 'mode' },
          { label: '最后验证', slot: 'verified' },
          { label: 'SHA-256', slot: 'sha' },
        ]" :key="row.slot" class="grid grid-cols-1 gap-0.5 max-[520px]:grid-cols-1 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-3">
          <dt class="text-sm text-muted-foreground">{{ row.label }}</dt>
          <dd class="m-0 min-w-0 break-words text-sm">
            <template v-if="row.slot === 'name'">{{ pluginName }}</template>
            <template v-else-if="row.slot === 'version'">{{ version.version }}</template>
            <template v-else-if="row.slot === 'level'"><PluginRequestLevelBadge :level="version.final_request_level" compact /></template>
            <template v-else-if="row.slot === 'mode'">{{ runtimeMode(version.runtime_mode) }}</template>
            <template v-else-if="row.slot === 'verified'">{{ version.last_verified_on }}</template>
            <template v-else><span class="font-mono text-xs">{{ version.code_sha256 }}</span></template>
          </dd>
        </div>
      </dl>

      <p class="mx-5 mb-4 border-l-[3px] border-[var(--lg-orange)] bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
        代码由上传者提供，本站不会执行或自动验证代码。安装前请阅读请求分析并自行确认风险。
      </p>
      <p
        v-if="copyBlocked"
        class="mx-5 mb-4 border-l-[3px] border-[var(--lg-yellow)] bg-[color-mix(in_srgb,var(--lg-yellow)_10%,var(--card))] px-3 py-2.5 text-[13px] text-muted-foreground"
      >
        完整代码大小为 {{ codeSize }}，超过 100 KiB，不能复制，请下载文件。
      </p>

      <DialogFooter class="items-center border-t border-border px-5 py-4">
        <Button variant="link" class="mr-auto px-0" @click="emit('analysis')">查看请求分析</Button>
        <Button variant="outline" @click="emit('close')">取消</Button>
        <Button :disabled="copyBlocked" @click="confirm">确认{{ action === 'copy' ? '复制' : '下载' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
