<script setup lang="ts">
import { ArrowLeft, Check, Copy, ExternalLink, RefreshCw } from 'lucide-vue-next'
import { Button, Input, Label, Textarea } from '~/components/ui'

type CardKind = 'activity' | 'random'

const route = useRoute()
const api = useApi()
const uid = String(route.params.uid || '')
const selected = ref<CardKind>('activity')
const copied = ref<'link' | 'markdown' | null>(null)
const imageNonce = ref(Date.now())

interface UserProfile {
  uid: number
  name: string
  avatar: string | null
  badge: string | null
  color: string
  ccf_level: number
  xcpc_level: number
  is_admin: boolean
  name_hidden: boolean
}

const { data: profile, status, error } = useLazyAsyncData(
  `user-card-${uid}`,
  () => api<UserProfile>(`/user/${uid}`),
  { server: false },
)

const pageTitle = computed(() => {
  const name = profile.value?.name_hidden ? `UID ${profile.value.uid}` : profile.value?.name
  return name ? `${name} 的图卡` : '图卡预览'
})

useHead(() => ({ title: pageTitle.value + ' - 洛谷档案馆' }))

const cardPath = computed(() => `/api/v1/image/feed/${selected.value}/${uid}.svg`)
const imageUrl = computed(() => {
  if (!import.meta.client) return cardPath.value
  return `${window.location.origin}${cardPath.value}`
})
const previewSrc = computed(() => `${cardPath.value}?t=${imageNonce.value}`)
const markdown = computed(() => {
  // 嵌入用 Markdown 保持最短格式，避免把用户名和图卡类型带到正文里。
  return `![](${imageUrl.value})`
})

const cardKinds: Array<{ key: CardKind; label: string }> = [
  { key: 'activity', label: '活跃统计' },
  { key: 'random', label: '随机语录' },
]

async function copyText(kind: 'link' | 'markdown') {
  const text = kind === 'link' ? imageUrl.value : markdown.value
  await navigator.clipboard.writeText(text)
  copied.value = kind
  setTimeout(() => { copied.value = null }, 1400)
}

function refreshPreview() {
  imageNonce.value = Date.now()
}
</script>

<template>
  <div class="archive-ui card-page">
    <ArchivePageHeader :title="pageTitle" description="洛谷用户 SVG 图卡" icon="card" />
    <div class="archive-card card-toolbar">
      <Button as-child variant="ghost" size="sm">
        <NuxtLink :to="'/user/' + uid"><ArrowLeft :size="15" aria-hidden="true" />返回用户主页</NuxtLink>
      </Button>
      <Button v-if="status === 'success'" variant="outline" size="sm" @click="refreshPreview">
        <RefreshCw :size="15" aria-hidden="true" />刷新预览
      </Button>
    </div>

    <LoadingPanel v-if="status === 'pending' || status === 'idle'" title="正在加载图卡" text="正在读取用户资料…" />
    <section v-else-if="error" class="archive-card card-panel card-error" role="alert">
      <h2>{{ error.data?.message || '用户未收录' }}</h2>
      <p class="archive-muted">稍后刷新页面即可重试。</p>
    </section>

    <div v-else class="preview-grid">
      <section class="archive-card card-panel preview-panel" aria-labelledby="card-preview-title">
        <h2 id="card-preview-title">图卡预览</h2>
        <div class="preview-shell">
          <img :src="previewSrc" :alt="selected === 'activity' ? '活跃统计图卡预览' : '随机语录图卡预览'">
        </div>
      </section>

      <aside class="archive-card card-panel side-panel" aria-label="图卡设置">
        <section class="panel-section">
          <h2 id="card-kind-title">图卡类型</h2>
          <div class="segmented" role="group" aria-labelledby="card-kind-title">
            <Button
              v-for="item in cardKinds"
              :key="item.key"
              type="button"
              variant="ghost"
              size="sm"
              :aria-pressed="selected === item.key"
              @click="selected = item.key; refreshPreview()"
            >{{ item.label }}</Button>
          </div>
        </section>

        <div class="panel-section">
          <Label for="card-image-link">图片链接</Label>
          <div class="copy-row">
            <Input id="card-image-link" :model-value="imageUrl" readonly />
            <Button variant="outline" @click="copyText('link')">
              <component :is="copied === 'link' ? Check : Copy" :size="15" aria-hidden="true" />
              {{ copied === 'link' ? '已复制' : '复制' }}
            </Button>
          </div>
        </div>

        <div class="panel-section">
          <Label for="card-image-markdown">Markdown</Label>
          <Textarea id="card-image-markdown" :model-value="markdown" readonly rows="3" />
          <Button variant="outline" @click="copyText('markdown')">
            <component :is="copied === 'markdown' ? Check : Copy" :size="15" aria-hidden="true" />
            {{ copied === 'markdown' ? '已复制 Markdown' : '复制 Markdown' }}
          </Button>
        </div>

        <Button as-child variant="ghost">
          <a :href="cardPath" target="_blank" rel="noopener noreferrer"><ExternalLink :size="15" aria-hidden="true" />打开图片</a>
        </Button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.card-page { display: grid; gap: 16px; width: min(100%, 1180px); margin-inline: auto; }
.card-toolbar { flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 12px 24px; }
.preview-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 340px); align-items: start; gap: 16px; }
.card-panel { min-width: 0; gap: 16px; padding: 20px; }
.card-panel h2 { margin: 0; font-size: 16px; }
.preview-shell { display: grid; place-items: center; min-height: 340px; padding: 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
.preview-shell img { display: block; width: 100%; height: auto; }
.side-panel { gap: 18px; }
.panel-section { display: grid; gap: 8px; min-width: 0; }
.segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 6px; background: var(--hover); }
.segmented [aria-pressed="true"] { background: var(--surface); border-color: var(--border); color: var(--text); }
.copy-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.copy-row .archive-button { min-width: 88px; }
.panel-section :is(.archive-input, .archive-textarea) { font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; }
.panel-section .archive-textarea { overflow-wrap: anywhere; }
.card-error { gap: 6px; }
.card-error p { margin: 0; }
@media (max-width: 880px) {
  .preview-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .card-toolbar, .card-panel { padding-inline: 16px; }
  .preview-shell { min-height: 200px; padding: 10px; }
}
</style>
