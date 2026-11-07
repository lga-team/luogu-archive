import type { SolutionDiffRow } from '../types/solutionFix'

export type SolutionDiffEntry =
  | { kind: 'row'; index: number; row: SolutionDiffRow }
  | { kind: 'fold'; start: number; count: number }

export function solutionChangeStarts(rows: readonly SolutionDiffRow[]) {
  return rows.flatMap((row, index) => row.kind !== 'same' && (index === 0 || rows[index - 1]!.kind === 'same') ? [index] : [])
}

export function solutionDiffEntries(rows: readonly SolutionDiffRow[], onlyChanges: boolean, expanded: ReadonlySet<number>): SolutionDiffEntry[] {
  const entries: SolutionDiffEntry[] = []
  const hasChanges = rows.some(row => row.kind !== 'same')
  for (let index = 0; index < rows.length;) {
    if (rows[index]!.kind !== 'same') {
      entries.push({ kind: 'row', index, row: rows[index++]! })
      continue
    }
    const start = index
    while (index < rows.length && rows[index]!.kind === 'same') index++
    if (onlyChanges) continue
    const before = start === 0 ? 0 : 3
    const after = index === rows.length ? 0 : 3
    const count = index - start - before - after
    const fold = hasChanges && count > 3 && !expanded.has(start)
    for (let cursor = start; cursor < index;) {
      if (fold && cursor === start + before) {
        entries.push({ kind: 'fold', start, count })
        cursor += count
      } else {
        entries.push({ kind: 'row', index: cursor, row: rows[cursor++]! })
      }
    }
  }
  return entries
}
