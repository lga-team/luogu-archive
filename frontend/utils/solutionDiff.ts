import type { DiffSegment, SolutionDiffKind, SolutionDiffReply, SolutionDiffRow } from '../types/solutionFix'

/** 大文本保护：超过该规模不做 O(n*m) LCS，退化为按位置对齐。 */
const MAX_LCS_CELLS = 4_000_000
const MAX_CHAR_CELLS = 160_000
const MAX_CHARS = 400

interface Lines { items: string[]; noNewline: boolean }

function splitLines(text: string): Lines {
  const normalized = text.replace(/\r\n?/g, '\n')
  const noNewline = normalized.length > 0 && !normalized.endsWith('\n')
  const items = normalized.split('\n')
  if (!noNewline && items.length > 1 && items[items.length - 1] === '') items.pop()
  return { items, noNewline }
}

function pushSegments(target: DiffSegment[], text: string, changed: boolean) {
  if (!text) return
  const last = target[target.length - 1]
  if (last && last.changed === changed) last.text += text
  else target.push({ text, changed })
}

/** 字符级 LCS：给「修改」行标出具体增删的字符。 */
function charSegments(left: string, right: string): { left?: DiffSegment[]; right?: DiffSegment[] } {
  const a = Array.from(left.slice(0, MAX_CHARS))
  const b = Array.from(right.slice(0, MAX_CHARS))
  const n = a.length
  const m = b.length
  if ((n + 1) * (m + 1) > MAX_CHAR_CELLS) return {}
  const width = m + 1
  const dp = new Uint16Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] = a[i] === b[j]
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }
  const leftOut: DiffSegment[] = []
  const rightOut: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSegments(leftOut, a[i], false); pushSegments(rightOut, b[j], false)
      i += 1; j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      pushSegments(leftOut, a[i], true); i += 1
    } else {
      pushSegments(rightOut, b[j], true); j += 1
    }
  }
  while (i < n) { pushSegments(leftOut, a[i], true); i += 1 }
  while (j < m) { pushSegments(rightOut, b[j], true); j += 1 }
  if (left.length > MAX_CHARS) pushSegments(leftOut, left.slice(MAX_CHARS), false)
  if (right.length > MAX_CHARS) pushSegments(rightOut, right.slice(MAX_CHARS), false)
  return { left: leftOut.length ? leftOut : undefined, right: rightOut.length ? rightOut : undefined }
}

interface Op {
  kind: Exclude<SolutionDiffKind, 'change'>
  text: string
  leftLine: number
  rightLine: number
}

function lcsOps(a: string[], b: string[], baseA: number, baseB: number): Op[] {
  const n = a.length
  const m = b.length
  const ops: Op[] = []
  if (!n && !m) return ops
  if ((n + 1) * (m + 1) > MAX_LCS_CELLS) {
    // 退化路径：逐位置配对，剩余行按增删处理。
    const shared = Math.min(n, m)
    for (let k = 0; k < shared; k += 1) {
      if (a[k] === b[k]) ops.push({ kind: 'same', text: a[k], leftLine: baseA + k + 1, rightLine: baseB + k + 1 })
      else {
        ops.push({ kind: 'remove', text: a[k], leftLine: baseA + k + 1, rightLine: 0 })
        ops.push({ kind: 'add', text: b[k], leftLine: 0, rightLine: baseB + k + 1 })
      }
    }
    for (let k = shared; k < n; k += 1) ops.push({ kind: 'remove', text: a[k], leftLine: baseA + k + 1, rightLine: 0 })
    for (let k = shared; k < m; k += 1) ops.push({ kind: 'add', text: b[k], leftLine: 0, rightLine: baseB + k + 1 })
    return ops
  }
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] = a[i] === b[j]
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', text: a[i], leftLine: baseA + i + 1, rightLine: baseB + j + 1 }); i += 1; j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      ops.push({ kind: 'remove', text: a[i], leftLine: baseA + i + 1, rightLine: 0 }); i += 1
    } else {
      ops.push({ kind: 'add', text: b[j], leftLine: 0, rightLine: baseB + j + 1 }); j += 1
    }
  }
  while (i < n) { ops.push({ kind: 'remove', text: a[i], leftLine: baseA + i + 1, rightLine: 0 }); i += 1 }
  while (j < m) { ops.push({ kind: 'add', text: b[j], leftLine: 0, rightLine: baseB + j + 1 }); j += 1 }
  return ops
}

/** 逐行差异 + 字符级标记，供题解修与插件版本对比共用（也在 Web Worker 中运行）。 */
export function buildSolutionDiff(leftText: string, rightText: string): SolutionDiffReply {
  const a = splitLines(leftText)
  const b = splitLines(rightText)
  const n = a.items.length
  const m = b.items.length

  // 先裁掉公共前缀/后缀，明显降低 LCS 规模。
  let prefix = 0
  while (prefix < n && prefix < m && a.items[prefix] === b.items[prefix]) prefix += 1
  let suffix = 0
  while (suffix < n - prefix && suffix < m - prefix
    && a.items[n - 1 - suffix] === b.items[m - 1 - suffix]) suffix += 1

  const middleA = a.items.slice(prefix, n - suffix)
  const middleB = b.items.slice(prefix, m - suffix)
  const ops = lcsOps(middleA, middleB, prefix, prefix)

  const rows: SolutionDiffRow[] = []
  for (let k = 0; k < prefix; k += 1) {
    rows.push({ kind: 'same', left: a.items[k], right: b.items[k], leftNo: k + 1, rightNo: k + 1 })
  }
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k]
    const next = ops[k + 1]
    // lcsOps 传入的 base 已是 prefix，行号直接是绝对行号；左右分别记录，插入后不会错位。
    if (op.kind === 'remove' && next?.kind === 'add') {
      const segments = charSegments(op.text, next.text)
      rows.push({
        kind: 'change', left: op.text, right: next.text,
        leftNo: op.leftLine, rightNo: next.rightLine,
        leftSegments: segments.left, rightSegments: segments.right,
      })
      k += 1
    } else if (op.kind === 'same') {
      rows.push({ kind: 'same', left: op.text, right: op.text, leftNo: op.leftLine, rightNo: op.rightLine })
    } else if (op.kind === 'remove') {
      rows.push({ kind: 'remove', left: op.text, right: '', leftNo: op.leftLine, rightNo: null })
    } else {
      rows.push({ kind: 'add', left: '', right: op.text, leftNo: null, rightNo: op.rightLine })
    }
  }
  for (let k = 0; k < suffix; k += 1) {
    const ai = n - suffix + k
    const bi = m - suffix + k
    rows.push({ kind: 'same', left: a.items[ai], right: b.items[bi], leftNo: ai + 1, rightNo: bi + 1 })
  }
  if (a.noNewline) {
    const last = [...rows].reverse().find(row => row.leftNo !== null)
    if (last) last.leftNoNewline = true
  }
  if (b.noNewline) {
    const last = [...rows].reverse().find(row => row.rightNo !== null)
    if (last) last.rightNoNewline = true
  }

  let added = 0
  let removed = 0
  for (const row of rows) {
    if (row.kind === 'add' || row.kind === 'change') added += 1
    if (row.kind === 'remove' || row.kind === 'change') removed += 1
  }
  return { status: 'ready', rows, added, removed }
}
