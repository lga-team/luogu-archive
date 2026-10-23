<script setup lang="ts">
interface VersionEntry {
  id: number
  title?: string | null
  content_md: string
  crawled_at: string
  is_current?: boolean
}

type DiffKind = 'same' | 'add' | 'remove' | 'change'

interface DiffRow {
  kind: DiffKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
}

const props = withDefaults(defineProps<{
  versions: VersionEntry[]
  emptyText?: string
}>(), {
  emptyText: '暂无历史版本',
})

const { render } = useMarkdown()
const { format } = useTime()

const openFull = ref<Set<number>>(new Set())
const copiedId = ref<number | null>(null)

const sortedVersions = computed(() =>
  [...props.versions].sort((a, b) =>
    new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime(),
  ),
)

const groups = computed(() => {
  const buckets: Array<{ date: string; versions: VersionEntry[] }> = []
  const byDate = new Map<string, VersionEntry[]>()
  for (const version of sortedVersions.value) {
    const key = format(version.crawled_at, 'YYYY-MM-DD')
    const list = byDate.get(key) || []
    list.push(version)
    byDate.set(key, list)
  }
  for (const [date, versions] of byDate) {
    buckets.push({ date, versions })
  }
  return buckets
})

const diffCache = computed(() => {
  const cache = new Map<number, DiffRow[]>()
  for (const version of sortedVersions.value) {
    const prev = previousOf(version)
    cache.set(version.id, buildDiff(prev?.content_md || '', version.content_md || ''))
  }
  return cache
})

const statCache = computed(() => {
  const cache = new Map<number, { add: number; remove: number }>()
  for (const version of sortedVersions.value) {
    let add = 0
    let remove = 0
    for (const row of diffOf(version)) {
      if (row.kind === 'add') add++
      if (row.kind === 'remove') remove++
      if (row.kind === 'change') {
        add++
        remove++
      }
    }
    cache.set(version.id, { add, remove })
  }
  return cache
})

function previousOf(version: VersionEntry): VersionEntry | null {
  const idx = sortedVersions.value.findIndex((item) => item.id === version.id)
  if (idx < 0 || idx + 1 >= sortedVersions.value.length) return null
  return sortedVersions.value[idx + 1]
}

function diffOf(version: VersionEntry): DiffRow[] {
  return diffCache.value.get(version.id) || []
}

function diffStats(version: VersionEntry) {
  return statCache.value.get(version.id) || { add: 0, remove: 0 }
}

function toggleFull(id: number) {
  const next = new Set(openFull.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openFull.value = next
}

async function copyVersion(version: VersionEntry) {
  await navigator.clipboard.writeText(version.content_md || '')
  copiedId.value = version.id
  setTimeout(() => {
    if (copiedId.value === version.id) copiedId.value = null
  }, 1400)
}

function htmlOf(version: VersionEntry) {
  return render(version.content_md || '')
}

function buildDiff(leftText: string, rightText: string): DiffRow[] {
  const a = leftText.replace(/\r\n/g, '\n').split('\n')
  const b = rightText.replace(/\r\n/g, '\n').split('\n')
  const n = a.length
  const m = b.length

  if (n * m > 2_000_000) {
    return buildSimpleDiff(a, b)
  }

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
  while (i < n) {
    ops.push({ kind: 'remove', text: a[i], line: i + 1 })
    i++
  }
  while (j < m) {
    ops.push({ kind: 'add', text: b[j], line: j + 1 })
    j++
  }

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

function buildSimpleDiff(a: string[], b: string[]): DiffRow[] {
  const rows: DiffRow[] = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    const left = a[i]
    const right = b[i]
    if (left === right) {
      rows.push({ kind: 'same', left: left ?? '', right: right ?? '', leftNo: i + 1, rightNo: i + 1 })
    } else if (left === undefined) {
      rows.push({ kind: 'add', left: '', right: right ?? '', leftNo: null, rightNo: i + 1 })
    } else if (right === undefined) {
      rows.push({ kind: 'remove', left: left ?? '', right: '', leftNo: i + 1, rightNo: null })
    } else {
      rows.push({ kind: 'change', left, right, leftNo: i + 1, rightNo: i + 1 })
    }
  }
  return rows
}

function changedRows(rows: DiffRow[]): DiffRow[] {
  return rows.filter((row) => row.kind !== 'same')
}
</script>

<template>
  <div class="space-y-5">
    <p
      v-if="!sortedVersions.length"
      class="rounded-xl border border-dashed border-border p-9 text-center text-sm text-muted-foreground"
    >
      {{ emptyText }}
    </p>

    <section v-for="group in groups" :key="group.date" class="space-y-3">
      <h2 class="text-sm font-semibold text-muted-foreground">{{ group.date }}</h2>

      <article
        v-for="version in group.versions"
        :key="version.id"
        class="overflow-hidden rounded-xl border border-border bg-card"
      >
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 max-sm:flex-col max-sm:items-stretch">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <strong class="max-w-[min(560px,100%)] truncate text-sm font-semibold">{{ version.title || `版本 ${version.id}` }}</strong>
            <span class="text-xs tabular-nums text-muted-foreground">{{ format(version.crawled_at, 'HH:mm:ss') }}</span>
            <span
              v-if="version.is_current"
              class="rounded-full border border-[var(--success)] px-2 py-px text-xs text-[var(--success)]"
            >当前版本</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">
            <span class="font-mono text-xs text-[var(--success)]">+{{ diffStats(version).add }}</span>
            <span class="font-mono text-xs text-[var(--destructive)]">-{{ diffStats(version).remove }}</span>
            <Button variant="outline" size="sm" @click="toggleFull(version.id)">
              {{ openFull.has(version.id) ? '收起全文' : '查看全文' }}
            </Button>
            <Button variant="outline" size="sm" @click="copyVersion(version)">
              {{ copiedId === version.id ? '已复制' : '复制原文' }}
            </Button>
          </div>
        </header>

        <div class="max-h-[460px] overflow-auto font-mono text-xs leading-normal">
          <div
            v-for="(row, idx) in changedRows(diffOf(version))"
            :key="idx"
            class="grid min-h-6 grid-cols-[54px_minmax(0,1fr)] border-b border-border/35"
            :class="row.kind === 'add'
              ? 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)]'
              : row.kind === 'remove'
                ? 'bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)]'
                : 'bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]'"
          >
            <span class="select-none bg-muted/80 px-2 py-[3px] text-right text-muted-foreground">{{ row.leftNo || row.rightNo || '' }}</span>
            <code class="whitespace-pre-wrap px-2.5 py-[3px] [overflow-wrap:anywhere]">
              <template v-if="row.kind === 'remove'">- {{ row.left }}</template>
              <template v-else-if="row.kind === 'add'">+ {{ row.right }}</template>
              <template v-else>- {{ row.left }}<br>+ {{ row.right }}</template>
            </code>
          </div>
          <p v-if="!changedRows(diffOf(version)).length" class="bg-muted/60 px-3 py-2 text-muted-foreground">
            与上一版本相比没有正文变化
          </p>
        </div>

        <div v-if="openFull.has(version.id)" class="border-t border-border px-4.5 py-4">
          <article class="lg-content" v-html="htmlOf(version)" />
        </div>
      </article>
    </section>
  </div>
</template>
