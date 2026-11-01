<script setup lang="ts">
const props = withDefaults(defineProps<{
  source?: string | null
  /** 可选的纯文本兜底；默认只显示 SSR 渲染结果。 */
  fallback?: string
}>(), { source: '', fallback: '' })

function hash(value: string): string {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36) + '-' + value.length.toString(36)
}

const key = 'md-' + hash(props.source || '')
const { data } = useAsyncData(
  key,
  async () => {
    if (!props.source) return ''
    const { renderArchiveMarkdown } = await import('~/lib/markdownRenderer')
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await renderArchiveMarkdown(props.source)
      } catch (error) {
        lastError = error
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 80))
      }
    }
    console.error('[Markdown] 渲染失败', lastError)
    const text = (props.fallback || props.source)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return '<p class="markdown-render-error">Markdown 渲染失败，请刷新重试。</p><pre>' + text + '</pre>'
  },
  { server: true, watch: [() => props.source] },
)

const html = computed(() => data.value || '')
</script>

<template>
  <div v-html="html" />
</template>
