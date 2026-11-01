<script setup lang="ts">
import { Check, Copy, FilePenLine, WandSparkles } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })
useHead({ title: '题解修 - 洛谷档案馆' })

type FixMode = 'local' | 'ai'
type DiffKind = 'same' | 'add' | 'remove' | 'change'

interface ArticleDetail {
  article_id: string
  title: string
  content_md: string
}

interface LocalFixResp {
  mode: 'local'
  content: string
  changed: boolean
  notes: string[]
}

interface DiffRow {
  kind: DiffKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
}

const api = useApi()
const auth = useAuthStore()
const config = useRuntimeConfig()

const fixMode = ref<FixMode>('local')
const sourceText = ref('')
const articleLink = ref('')
const articleTitle = ref('')
const originalText = ref('')
const fixedText = ref('')
const thoughts = ref('')
const notes = ref<string[]>([])
const logs = ref<string[]>([])
const busy = ref(false)
const copied = ref(false)
const errorMessage = ref('')

function setFixMode(value: string) {
  fixMode.value = value === 'ai' ? 'ai' : 'local'
}

const canRun = computed(() => {
  if (busy.value) return false
  return sourceText.value.trim().length > 0 || articleLink.value.trim().length > 0
})

const diffRows = computed(() => buildDiff(originalText.value, fixedText.value))
const changedCount = computed(() =>
  diffRows.value.filter((row) => row.kind === 'add' || row.kind === 'remove' || row.kind === 'change').length,
)

function addLog(message: string) {
  logs.value.push(message)
}

function parseArticleId(input: string): string {
  let value = input.trim()
  if (/^[A-Za-z0-9_-]{1,64}$/.test(value)) return value
  if (/^(?:www\.)?luogu\./i.test(value)) value = `https://${value}`
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    const hosts = ['www.luogu.com.cn', 'luogu.com.cn', 'www.luogu.com', 'luogu.com']
    if (!hosts.includes(url.hostname.toLowerCase())) throw new Error('只支持洛谷文章链接')
    value = url.pathname
  }
  const m = value.match(/^\/(?:article|atricle)\/([A-Za-z0-9_-]{1,64})\/?$/i)
  if (!m) throw new Error('支持 /article/{id}、洛谷文章链接或纯文章 ID')
  return m[1]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitArticleReady(id: string): Promise<ArticleDetail> {
  for (let i = 0; i < 24; i++) {
    if (i > 0) await sleep(1500)
    try {
      return await api<ArticleDetail>(`/article/${id}`)
    } catch (err: any) {
      const status = err?.statusCode || err?.response?.status
      if (status && status !== 404) throw err
      if (i === 0) addLog('等待文章收录完成')
    }
  }
  throw new Error('文章暂未收录完成，请稍后再试')
}

async function loadInputText(): Promise<string> {
  const link = articleLink.value.trim()
  const pasted = sourceText.value.trim()
  if (!link) {
    articleTitle.value = ''
    return sourceText.value
  }

  if (pasted) {
    addLog('检测到同时提供 Markdown 和文章链接，已优先使用文章链接')
  }
  const id = parseArticleId(link)
  addLog(`提交文章 ${id} 到保存队列`)
  const saved = await api<{ task_id: string; merged: boolean }>('/save', {
    method: 'POST',
    body: { content_type: 'article', id },
  })
  addLog(saved.merged ? '复用已有保存任务' : '已派发保存任务')
  addLog('读取文章正文')
  const article = await waitArticleReady(id)
  articleTitle.value = article.title
  return article.content_md
}

async function runFix() {
  if (!canRun.value) return
  busy.value = true
  errorMessage.value = ''
  notes.value = []
  logs.value = []
  thoughts.value = ''
  fixedText.value = ''
  copied.value = false

  try {
    const input = await loadInputText()
    originalText.value = input
    if (fixMode.value === 'local') {
      addLog('执行本地格式修正')
      const resp = await api<LocalFixResp>('/solution-fix/local', {
        method: 'POST',
        body: { content: input },
      })
      fixedText.value = resp.content
      notes.value = resp.notes
      addLog(resp.changed ? '本地修正完成' : '未发现需要修正的格式问题')
    } else {
      if (!auth.isLoggedIn) throw new Error('AI 修正需要先登录')
      addLog('连接 AI 修正流')
      await runAiFix(input)
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || '修正失败'
  } finally {
    busy.value = false
  }
}

async function runAiFix(input: string) {
  const base = useApiBase()
  const resp = await fetch(`${base}/api/v1/solution-fix/ai`, {
    method: 'POST',
    credentials: useApiCredentials(),
    headers: {
      'Content-Type': 'application/json',
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
    },
    body: JSON.stringify({ content: input }),
  })
  if (!resp.ok || !resp.body) {
    let message = `AI 修正失败（${resp.status}）`
    try {
      const data = await resp.json()
      message = data?.message || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const msg = JSON.parse(line)
      if (msg.event === 'meta') {
        addLog(`模型：${msg.data.model}`)
      } else if (msg.event === 'thought') {
        thoughts.value += msg.data
      } else if (msg.event === 'content') {
        fixedText.value += msg.data
      } else if (msg.event === 'done') {
        addLog('AI 修正完成')
      } else if (msg.event === 'error') {
        throw new Error(msg.data)
      }
    }
  }
}

async function copyResult() {
  if (!fixedText.value) return
  await navigator.clipboard.writeText(fixedText.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1400)
}

function buildDiff(leftText: string, rightText: string): DiffRow[] {
  if (!leftText && !rightText) return []
  const a = leftText.replace(/\r\n/g, '\n').split('\n')
  const b = rightText.replace(/\r\n/g, '\n').split('\n')
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: Array<{ kind: 'same' | 'add' | 'remove'; text: string; line: number }> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', text: a[i], line: i + 1 })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'remove', text: a[i], line: i + 1 })
      i++
    } else {
      ops.push({ kind: 'add', text: b[j], line: j + 1 })
      j++
    }
  }
  while (i < n) ops.push({ kind: 'remove', text: a[i], line: ++i })
  while (j < m) ops.push({ kind: 'add', text: b[j], line: ++j })

  const rows: DiffRow[] = []
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]
    const next = ops[k + 1]
    if (op.kind === 'remove' && next?.kind === 'add') {
      rows.push({ kind: 'change', left: op.text, right: next.text, leftNo: op.line, rightNo: next.line })
      k++
    } else if (op.kind === 'same') {
      rows.push({ kind: 'same', left: op.text, right: op.text, leftNo: op.line, rightNo: op.line })
    } else if (op.kind === 'remove') {
      rows.push({ kind: 'remove', left: op.text, right: '', leftNo: op.line, rightNo: null })
    } else {
      rows.push({ kind: 'add', left: '', right: op.text, leftNo: null, rightNo: op.line })
    }
  }
  return rows
}
</script>

<template>

  <div class="page fix-page">
    <PageHeader
      title="题解修"
      description="对题解 Markdown 做格式修正，保留洛谷扩展语法；AI 模式需要登录。"
      eyebrow="Solution fix"
    >
      <template #icon><FilePenLine :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <section class="fix-shell" :class="{ 'has-result': busy || Boolean(fixedText) }">
      <div class="card fix-input">
        <div class="card__header">
          <div>
            <h2 class="card__title">输入</h2>
            <p class="card__description">粘贴 Markdown，或填写洛谷文章链接自动读取。</p>
          </div>
        </div>
        <div class="card__body stack">
          <FTextarea
            v-model="sourceText"
            :rows="12"
            placeholder="粘贴题解 Markdown…"
            aria-label="题解 Markdown"
          />
          <div class="stack stack--xs">
            <span class="field-label">或从洛谷文章读取</span>
            <FInput v-model="articleLink" placeholder="/article/xxxxxxxx、链接或纯 ID" aria-label="洛谷文章链接" />
            <span class="field-help">同时填写时优先使用文章链接。</span>
          </div>

          <FTabList
            :model-value="fixMode"
            :tabs="[{ id: 'local', label: '本地修正' }, { id: 'ai', label: 'AI 修正' }]"
            aria-label="修正模式"
            @update:model-value="setFixMode"
          />

          <FButton appearance="primary" size="large" block :disabled="!canRun" :loading="busy" @click="runFix">
            <template #start><WandSparkles v-if="!busy" :size="17" aria-hidden="true" /></template>
            {{ busy ? '处理中…' : '开始修正' }}
          </FButton>

          <p v-if="errorMessage" class="notice notice--warn" role="alert">{{ errorMessage }}</p>
          <div v-if="notes.length" class="cluster">
            <span v-for="note in notes" :key="note" class="tag">{{ note }}</span>
          </div>
        </div>
      </div>

      <div class="card fix-result">
        <div class="card__header">
          <div>
            <h2 class="card__title">{{ articleTitle || '修正结果' }}</h2>
            <p class="card__description">{{ fixedText ? '变更行 ' + changedCount : '等待输入后生成差异对比' }}</p>
          </div>
          <FButton appearance="outline" size="small" :disabled="!fixedText" @click="copyResult">
            <template #start><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" /></template>
            {{ copied ? '已复制' : '复制结果' }}
          </FButton>
        </div>

        <div class="diff-head">
          <span>原文</span>
          <span>修正后</span>
        </div>
        <div class="diff-view">
          <div v-for="(row, idx) in diffRows" :key="idx" class="diff-row" :class="row.kind">
            <div class="line-cell">
              <span class="line-no">{{ row.leftNo || '' }}</span>
              <code>{{ row.left }}</code>
            </div>
            <div class="line-cell">
              <span class="line-no">{{ row.rightNo || '' }}</span>
              <code>{{ row.right }}</code>
            </div>
          </div>
          <EmptyState v-if="!diffRows.length" title="暂无结果" description="输入内容并开始修正后，这里会显示逐行差异。" />
        </div>
      </div>
    </section>

    <section class="card trace-panel">
      <details open>
        <summary class="trace-summary">模型思路 / 处理记录</summary>
        <div class="trace-grid">
          <pre>{{ thoughts || '当前模型未返回可展示的思考内容。' }}</pre>
          <ul>
            <li v-for="(log, idx) in logs" :key="idx">{{ log }}</li>
            <li v-if="!logs.length">等待开始</li>
          </ul>
        </div>
      </details>
    </section>
  </div>

</template>

<style scoped>
.fix-shell { display: grid; grid-template-columns: minmax(320px, 380px) minmax(0, 1fr); gap: 16px; align-items: stretch; min-width: 0; }
.fix-shell.has-result { align-items: start; }
.fix-shell.has-result .fix-result { align-self: start; height: auto; max-height: calc(100dvh - 120px); }
.fix-shell.has-result .diff-view { min-height: 360px; }
.fix-shell > * { min-width: 0; }
.fix-input { min-width: 0; display: flex; flex-direction: column; }
.fix-input > .card__body { flex: 1 1 auto; }
.fix-input .card__body { padding: 16px; min-width: 0; }
.fix-input :deep(fluent-textarea) { width: 100%; }
.fix-result { overflow: hidden; display: flex; flex-direction: column; }
.diff-head {
  display: grid; grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--colorNeutralStroke2); border-bottom: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground2); color: var(--colorNeutralForeground3);
  font-size: 11px; font-weight: 600;
}
.diff-head span { padding: 7px 12px; }
.diff-head span + span { border-left: 1px solid var(--colorNeutralStroke2); }
.diff-view {
  overflow: auto; min-height: 440px; max-height: none; flex: 1 1 auto;
  font-family: var(--fontFamilyMonospace); font-size: 12px; line-height: 1.5;
}
.diff-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 24px; }
.line-cell { display: grid; grid-template-columns: 46px minmax(0, 1fr); border-bottom: 1px solid var(--colorNeutralStroke2); min-width: 0; }
.line-cell + .line-cell { border-left: 1px solid var(--colorNeutralStroke2); }
.line-no { padding: 3px 7px; color: var(--colorNeutralForeground4); text-align: right; user-select: none; background: var(--colorNeutralBackground2); }
.line-cell code { padding: 3px 9px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--colorNeutralForeground1); font: inherit; }
.diff-row.add .line-cell:nth-child(2),
.diff-row.change .line-cell:nth-child(2) { background: color-mix(in srgb, var(--colorPaletteGreenBackground1, #dff6dd) 60%, transparent); }
.diff-row.remove .line-cell:nth-child(1),
.diff-row.change .line-cell:nth-child(1) { background: color-mix(in srgb, var(--colorPaletteRedBackground1, #fde7e9) 60%, transparent); }
.trace-panel { overflow: hidden; }
.trace-summary { padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: 13px; list-style: none; }
.trace-summary::-webkit-details-marker { display: none; }
.trace-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 1px; background: var(--colorNeutralStroke2); border-top: 1px solid var(--colorNeutralStroke2); }
.trace-grid > * { margin: 0; padding: 14px 16px; background: var(--colorNeutralBackground1); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }
.trace-grid pre { white-space: pre-wrap; max-height: 280px; overflow: auto; font-family: var(--fontFamilyMonospace); }
.trace-grid ul { list-style: none; display: flex; flex-direction: column; gap: 5px; color: var(--colorNeutralForeground3); }
@media (max-width: 1020px) {
  .fix-shell { grid-template-columns: minmax(0, 1fr); }
  .trace-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
