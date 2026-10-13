<script setup lang="ts">
import type { Root } from 'react-dom/client'
import type { Announcement, ArchivePageProps } from '../react/archive-page'

const props = defineProps<{ page: 'home' | 'announcement' }>()
const host = ref<HTMLElement | null>(null)
const config = useRuntimeConfig()
const route = useRoute()
const api = useApi()
let root: Root | undefined
let disposed = false
let draw: (() => void) | undefined

// 迁移期间仅挂载两个 React 页面，侧栏、登录和旧路由仍由现有应用负责。
onMounted(async () => {
  const [{ createRoot }, { createElement }, { ArchivePage }, markdownModule] = await Promise.all([
    import('react-dom/client'), import('react'), import('../react/archive-page'),
    // 主页没有正文，不提前下载 Markdown 与 KaTeX 渲染代码。
    props.page === 'announcement' ? import('../composables/useMarkdown') : Promise.resolve(null),
  ])
  if (disposed || !host.value) return
  root = createRoot(host.value)
  draw = () => {
    const pageProps: ArchivePageProps = {
      page: props.page,
      selectedId: Number(route.query.id) || null,
      extended: Boolean(config.public.extendedArchiveModulesEnabled),
      // 主页只取最新公告；历史正文仅在公告页加载，避免无用的传输。
      loadAnnouncements: () => api<Announcement[]>('/site/announcements', {
        query: { limit: props.page === 'home' ? 1 : 50 },
      }),
      navigate: (path) => { void navigateTo(path) },
      renderMarkdown: markdownModule?.useMarkdown().render || (() => ''),
    }
    root?.render(createElement(ArchivePage, pageProps))
  }
  draw()
})
watch(() => [props.page, route.query.id], () => draw?.())
onBeforeUnmount(() => {
  disposed = true
  root?.unmount()
})
</script>

<template>
  <div ref="host" class="archive-react">
    <!-- 服务端保留品牌占位，React 到达前不出现空白整页。 -->
    <div v-if="page === 'home'" class="archive-home">
      <div class="archive-wordmark"><img src="/favicon.png" alt=""><h1>洛谷档案馆</h1></div>
    </div>
    <h1 v-else>站点公告</h1>
  </div>
</template>

<style src="../react/archive.css" />
