<script setup lang="ts">
import { ArrowLeft, Check, Copy, ExternalLink, Image as ImageIcon, RefreshCw } from 'lucide-vue-next'

type CardKind = 'activity' | 'random'
const route = useRoute()
const api = useApi()
const apiBase = useApiBase()
const uid = String(route.params.uid || '')
const selected = ref('activity')
const copied = ref<'link' | 'markdown' | null>(null)
const imageNonce = ref(Date.now())

interface UserProfile {
  uid: number; name: string; avatar: string | null; badge: string | null; color: string
  ccf_level: number; xcpc_level: number; is_admin: boolean; name_hidden: boolean
}
const { data: profile, pending, error } = useLazyAsyncData(
  `user-card-${uid}`,
  () => api<UserProfile>(`/user/${uid}`),
  { server: false },
)
const pageTitle = computed(() => {
  const name = profile.value?.name_hidden ? `UID ${profile.value.uid}` : profile.value?.name
  return name ? `${name} 的图卡` : '图卡预览'
})
const cardPath = computed(() => `/api/v1/image/feed/${selected.value}/${uid}.svg`)
const absoluteCardPath = computed(() => (apiBase ? apiBase : '') + cardPath.value)
const imageUrl = computed(() => {
  if (!import.meta.client) return absoluteCardPath.value
  try { return new URL(absoluteCardPath.value, window.location.origin).href }
  catch { return absoluteCardPath.value }
})
const previewSrc = computed(() => `${absoluteCardPath.value}?t=${imageNonce.value}`)
const markdown = computed(() => `![](${imageUrl.value})`)
const tabs = [
  { id: 'activity', label: '活跃统计' },
  { id: 'random', label: '随机语录' },
]
function selectKind(value: string) {
  selected.value = value === 'random' ? 'random' : 'activity'
  refreshPreview()
}
async function copyText(kind: 'link' | 'markdown') {
  const text = kind === 'link' ? imageUrl.value : markdown.value
  await navigator.clipboard.writeText(text)
  copied.value = kind
  setTimeout(() => { copied.value = null }, 1400)
}
function refreshPreview() { imageNonce.value = Date.now() }
</script>

<template>
  <LoadingPanel v-if="pending" variant="detail" title="正在加载图卡" />

  <div v-else-if="error" class="page page--medium">
    <EmptyState title="用户未收录" :description="(error as any)?.data?.message || '稍后刷新页面即可重试。'">
      <template #actions><FButton appearance="outline" :href="'/user/' + uid">返回用户主页</FButton></template>
    </EmptyState>
  </div>

  <div v-else class="page page--medium card-page">
    <PageHeader :title="pageTitle" description="预览 SVG 图卡，并复制可嵌入链接。" eyebrow="Profile card">
      <template #icon><ImageIcon :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" :href="'/user/' + uid">
          <template #start><ArrowLeft :size="15" aria-hidden="true" /></template>返回主页
        </FButton>
        <FButton appearance="subtle" @click="refreshPreview">
          <template #start><RefreshCw :size="15" aria-hidden="true" /></template>刷新预览
        </FButton>
      </template>
    </PageHeader>

    <div class="preview-grid">
      <section class="card preview-panel">
        <div class="preview-shell" :class="selected">
          <img :src="previewSrc" :alt="selected === 'activity' ? '活跃统计图卡预览' : '随机语录图卡预览'">
        </div>
      </section>

      <aside class="card side-panel">
        <div class="stack stack--sm">
          <span class="field-label">图卡类型</span>
          <FTabList :model-value="selected" :tabs="tabs" aria-label="图卡类型" @update:model-value="selectKind" />
        </div>

        <div class="stack stack--sm">
          <span class="field-label">图片链接</span>
          <div class="input-row" style="flex-wrap:wrap">
            <FInput :model-value="imageUrl" readonly class="grow" aria-label="图片链接" />
            <FButton appearance="outline" @click="copyText('link')">
              <template #start><component :is="copied === 'link' ? Check : Copy" :size="14" aria-hidden="true" /></template>
              {{ copied === 'link' ? '已复制' : '复制' }}
            </FButton>
          </div>
        </div>

        <div class="stack stack--sm">
          <span class="field-label">Markdown</span>
          <FTextarea :model-value="markdown" readonly :rows="4" aria-label="Markdown 嵌入代码" />
          <FButton appearance="primary" block @click="copyText('markdown')">
            <template #start><component :is="copied === 'markdown' ? Check : Copy" :size="14" aria-hidden="true" /></template>
            {{ copied === 'markdown' ? '已复制 Markdown' : '复制 Markdown' }}
          </FButton>
        </div>

        <FButton appearance="outline" block :href="absoluteCardPath" target="_blank">
          <template #start><ExternalLink :size="15" aria-hidden="true" /></template>打开图片
        </FButton>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.preview-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
.preview-panel { padding: 20px; }
.preview-shell {
  display: grid; place-items: center; min-height: 460px; padding: 22px; border-radius: var(--borderRadiusLarge);
  background:
    linear-gradient(45deg, var(--colorNeutralBackground3) 25%, transparent 25%),
    linear-gradient(-45deg, var(--colorNeutralBackground3) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--colorNeutralBackground3) 75%),
    linear-gradient(-45deg, transparent 75%, var(--colorNeutralBackground3) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
}
.preview-shell img { display: block; width: 100%; height: auto; max-height: 100%; object-fit: contain; }
.preview-shell.random img { max-width: 900px; }
.side-panel { padding: 18px; display: flex; flex-direction: column; gap: 18px; }
.side-panel :deep(fluent-tablist) { width: 100%; }
@media (max-width: 980px) {
  .preview-grid { grid-template-columns: minmax(0, 1fr); }
  .side-panel { order: -1; }
}
@media (max-width: 680px) {
  .preview-panel { padding: 12px; }
  .preview-shell { min-height: 260px; padding: 10px; }
}
</style>
