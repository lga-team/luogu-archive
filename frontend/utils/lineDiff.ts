export type DiffKind = 'same' | 'add' | 'remove' | 'change'

export interface DiffRow {
  kind: DiffKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
}

/** 基于 LCS 的逐行 diff，用于版本对比与题解修复。 */
export function buildLineDiff(leftText: string, rightText: string): DiffRow[] {
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
