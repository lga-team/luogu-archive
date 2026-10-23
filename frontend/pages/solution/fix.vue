<script setup lang="ts">
definePageMeta({ layout: 'default' })

import { ArrowRight, ChevronDown, Copy } from '@lucide/vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'

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
  const base = import.meta.server
    ? config.apiInternalUrl
    : config.public.apiBaseUrl
  const resp = await fetch(`${base}/api/v1/solution-fix/ai`, {
    method: 'POST',
    credentials: 'include',
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

useHead({ title: '题解修 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="border-b border-border pb-4">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">工具</p>
      <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">题解修</h1>
      <p class="mt-1 text-sm text-muted-foreground">对题解 Markdown 做格式修正，保留洛谷扩展语法；AI 模式需要登录。</p>
    </header>

    <section class="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-stretch">
      <!-- 输入 -->
      <Card class="grid grid-rows-[auto_auto_auto_auto_auto_auto] gap-3.5 py-5 lg:min-h-[560px]">
        <CardHeader class="px-5">
          <CardTitle class="text-lg">输入</CardTitle>
        </CardHeader>
        <CardContent class="min-h-[220px] px-5">
          <Textarea
            v-model="sourceText"
            placeholder="粘贴题解 Markdown..."
            spellcheck="false"
            class="min-h-[260px] h-full resize-y font-mono text-[13px] leading-relaxed"
          />
        </CardContent>
        <CardContent class="grid gap-1.5 px-5 pt-0">
          <span class="text-xs font-semibold text-muted-foreground">粘贴文章链接...</span>
          <Input
            v-model="articleLink"
            placeholder="/article/xxxxxxxx、www.luogu.com.cn/article/xxxxxxxx 或纯 ID"
            spellcheck="false"
          />
        </CardContent>
        <CardContent class="px-5 pt-0">
          <Tabs v-model="fixMode" class="w-full">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="local">本地修正</TabsTrigger>
              <TabsTrigger value="ai">AI 修正</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
        <CardContent class="px-5 pt-0">
          <Button class="w-full" :disabled="!canRun" @click="runFix">
            <ArrowRight class="size-4" />
            {{ busy ? '处理中...' : '开始修正' }}
          </Button>
        </CardContent>
        <CardContent class="space-y-2.5 px-5 pt-0">
          <p v-if="errorMessage" class="text-[13px] text-[var(--destructive)]">{{ errorMessage }}</p>
          <div v-if="notes.length" class="flex flex-wrap gap-2">
            <span
              v-for="note in notes"
              :key="note"
              class="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
            >{{ note }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- 结果 -->
      <Card class="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden py-0">
        <CardHeader class="border-b border-border px-5 py-4">
          <CardTitle class="text-lg">{{ articleTitle || '修正结果' }}</CardTitle>
          <CardDescription class="text-[13px]">
            {{ fixedText ? `变更行 ${changedCount}` : '等待输入后生成差异对比' }}
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" :disabled="!fixedText" @click="copyResult">
              <Copy class="size-3.5" />
              {{ copied ? '已复制' : '复制' }}
            </Button>
          </CardAction>
        </CardHeader>

        <div class="grid grid-cols-2 border-b border-border bg-muted/60 text-xs font-bold text-muted-foreground">
          <span class="border-r border-border px-3 py-1.5">原文</span>
          <span class="px-3 py-1.5">修正后</span>
        </div>

        <div class="min-h-[460px] overflow-auto font-mono text-xs leading-normal">
          <div
            v-for="(row, idx) in diffRows"
            :key="idx"
            class="grid min-h-6 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div
              class="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] border-b border-[color-mix(in_srgb,var(--border)_45%,transparent)] border-r border-border"
              :class="(row.kind === 'remove' || row.kind === 'change') && 'bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]'"
            >
              <span class="select-none bg-muted/70 px-2 py-[3px] text-right text-muted-foreground">{{ row.leftNo || '' }}</span>
              <code class="whitespace-pre-wrap px-2.5 py-[3px] [overflow-wrap:anywhere]">{{ row.left }}</code>
            </div>
            <div
              class="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] border-b border-[color-mix(in_srgb,var(--border)_45%,transparent)]"
              :class="(row.kind === 'add' || row.kind === 'change') && 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)]'"
            >
              <span class="select-none bg-muted/70 px-2 py-[3px] text-right text-muted-foreground">{{ row.rightNo || '' }}</span>
              <code class="whitespace-pre-wrap px-2.5 py-[3px] [overflow-wrap:anywhere]">{{ row.right }}</code>
            </div>
          </div>
          <div v-if="!diffRows.length" class="grid min-h-[360px] place-items-center text-sm text-muted-foreground">暂无结果</div>
        </div>
      </Card>
    </section>

    <!-- 模型思路 / 处理记录 -->
    <Card class="mt-4 gap-0 overflow-hidden py-0">
      <Collapsible default-open class="group">
        <CollapsibleTrigger as-child>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left font-bold"
          >
            模型思路 / 处理记录
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="grid border-t border-border lg:grid-cols-[minmax(0,1fr)_320px]">
            <pre class="m-0 max-h-[260px] min-h-[120px] overflow-auto whitespace-pre-wrap border-b border-border px-4 py-3.5 font-mono text-[13px] leading-relaxed text-muted-foreground lg:border-b-0 lg:border-r">{{ thoughts || '当前模型未返回可展示的思考内容。' }}</pre>
            <ul class="m-0 max-h-[260px] min-h-[120px] list-decimal overflow-auto px-9 py-3.5 text-[13px] text-muted-foreground">
              <li v-for="(log, idx) in logs" :key="idx">{{ log }}</li>
              <li v-if="!logs.length">等待开始</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  </div>
</template>
