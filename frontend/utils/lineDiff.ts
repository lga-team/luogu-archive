export type DiffKind = 'same' | 'add' | 'remove' | 'change'

export interface DiffRow {
  kind: DiffKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
}

/** LCS 矩阵规模上限：超过后退化为按位置对齐，保证不会把主线程卡死。 */
const MAX_LCS_CELLS = 4_000_000

export function buildLineDiff(leftText: string, rightText: string): DiffRow[] {
  if (!leftText && !rightText) return []
  const a = leftText.replace(/\r\n/g, '\n').split('\n')
  const b = rightText.replace(/\r\n/g, '\n').split('\n')
  const n = a.length
  const m = b.length

  let prefix = 0
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix]) suffix++

  const rows: DiffRow[] = []
  for (let k = 0; k < prefix; k++) {
    rows.push({ kind: 'same', left: a[k], right: a[k], leftNo: k + 1, rightNo: k + 1 })
  }
  for (const row of diffMiddle(a.slice(prefix, n - suffix), b.slice(prefix, m - suffix), prefix)) rows.push(row)
  for (let k = 0; k < suffix; k++) {
    const i = n - suffix + k
    const j = m - suffix + k
    rows.push({ kind: 'same', left: a[i], right: b[j], leftNo: i + 1, rightNo: j + 1 })
  }
  return rows
}

function diffMiddle(a: string[], b: string[], base: number): DiffRow[] {
  const n = a.length
  const m = b.length
  if (!n && !m) return []

  const rows: DiffRow[] = []
  const lineNo = (k: number) => base + k + 1

  if ((n + 1) * (m + 1) > MAX_LCS_CELLS) {
    // 退化路径：逐位置配对（同一位置的差异合并成 change），剩余行按纯增/删处理。
    const shared = Math.min(n, m)
    for (let k = 0; k < shared; k++) {
      if (a[k] === b[k]) {
        rows.push({ kind: 'same', left: a[k], right: b[k], leftNo: lineNo(k), rightNo: lineNo(k) })
      } else {
        rows.push({ kind: 'change', left: a[k], right: b[k], leftNo: lineNo(k), rightNo: lineNo(k) })
      }
    }
    for (let k = shared; k < n; k++) {
      rows.push({ kind: 'remove', left: a[k], right: '', leftNo: lineNo(k), rightNo: null })
    }
    for (let k = shared; k < m; k++) {
      rows.push({ kind: 'add', left: '', right: b[k], leftNo: null, rightNo: lineNo(k) })
    }
    return rows
  }

  // 行文本 → 整数 id，LCS 内层只比较数字。
  const ids = new Map<string, number>()
  const idOf = (text: string) => {
    let id = ids.get(text)
    if (id === undefined) {
      id = ids.size
      ids.set(text, id)
    }
    return id
  }
  const ai = new Int32Array(n)
  const bi = new Int32Array(m)
  for (let k = 0; k < n; k++) ai[k] = idOf(a[k])
  for (let k = 0; k < m; k++) bi[k] = idOf(b[k])

  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    const rowBase = i * width
    const nextBase = rowBase + width
    const aiVal = ai[i]
    for (let j = m - 1; j >= 0; j--) {
      dp[rowBase + j] = aiVal === bi[j]
        ? dp[nextBase + j + 1] + 1
        : Math.max(dp[nextBase + j], dp[rowBase + j + 1])
    }
  }

  // 先收集原始操作，再按「remove + add」合并成 change。
  type Op = { kind: 'same' | 'add' | 'remove'; text: string; line: number }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (ai[i] === bi[j]) {
      ops.push({ kind: 'same', text: a[i], line: i + 1 })
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
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

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]
    const next = ops[k + 1]
    if (op.kind === 'remove' && next?.kind === 'add') {
      rows.push({ kind: 'change', left: op.text, right: next.text, leftNo: base + op.line, rightNo: base + next.line })
      k++
    } else if (op.kind === 'same') {
      rows.push({ kind: 'same', left: op.text, right: op.text, leftNo: base + op.line, rightNo: base + op.line })
    } else if (op.kind === 'remove') {
      rows.push({ kind: 'remove', left: op.text, right: '', leftNo: base + op.line, rightNo: null })
    } else {
      rows.push({ kind: 'add', left: '', right: op.text, leftNo: null, rightNo: base + op.line })
    }
  }
  return rows
}
