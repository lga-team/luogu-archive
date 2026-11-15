import type { SolutionDiffRow } from '../types/solutionFix'

export type DiffEntry =
  | { kind: 'row'; index: number; row: SolutionDiffRow }
  | { kind: 'fold'; start: number; count: number }

const FOLD_MIN = 10
const FOLD_CONTEXT = 2

/** 所有变更行的位置，供「上一处 / 下一处」导航。 */
export function solutionChangeStarts(rows: readonly SolutionDiffRow[]): number[] {
  const starts: number[] = []
  rows.forEach((row, index) => { if (row.kind !== 'same') starts.push(index) })
  return starts
}

/** 生成渲染条目：连续未修改行折叠，仅看差异时只保留变更行。 */
export function solutionDiffEntries(
  rows: readonly SolutionDiffRow[],
  onlyChanges: boolean,
  expanded: ReadonlySet<number>,
): DiffEntry[] {
  const entries: DiffEntry[] = []
  if (onlyChanges) {
    rows.forEach((row, index) => {
      if (row.kind !== 'same') entries.push({ kind: 'row', index, row })
    })
    return entries
  }
  const row = (index: number): DiffEntry => ({ kind: 'row', index, row: rows[index] })
  let cursor = 0
  while (cursor < rows.length) {
    if (rows[cursor].kind !== 'same') { entries.push(row(cursor)); cursor += 1; continue }
    let end = cursor
    while (end < rows.length && rows[end].kind === 'same') end += 1
    const run = end - cursor
    if (run < FOLD_MIN) {
      for (let k = cursor; k < end; k += 1) entries.push(row(k))
      cursor = end
      continue
    }
    const foldStart = cursor + FOLD_CONTEXT
    const foldEnd = end - FOLD_CONTEXT
    for (let k = cursor; k < foldStart; k += 1) entries.push(row(k))
    if (expanded.has(foldStart)) {
      for (let k = foldStart; k < foldEnd; k += 1) entries.push(row(k))
    } else {
      entries.push({ kind: 'fold', start: foldStart, count: foldEnd - foldStart })
    }
    for (let k = foldEnd; k < end; k += 1) entries.push(row(k))
    cursor = end
  }
  return entries
}
