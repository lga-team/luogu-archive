import { diffChars, diffLines } from 'diff'
import type { SolutionDiffReply, SolutionDiffRow, SolutionDiffSegment } from '../types/solutionFix'

const maxCharacters = 1_000_000
const maxLines = 20_000
const maxInlineCharacters = 6000

function inlineSegments(left: string, right: string, deadline: number) {
  const remaining = deadline - Date.now()
  if (left === right || left.length + right.length > maxInlineCharacters || remaining <= 0) return {}
  const changes = diffChars(left, right, { timeout: Math.min(25, remaining), maxEditLength: 1000 })
  if (!changes) return {}
  const leftSegments: SolutionDiffSegment[] = []
  const rightSegments: SolutionDiffSegment[] = []
  for (const change of changes) {
    if (!change.added) leftSegments.push({ text: change.value, changed: Boolean(change.removed) })
    if (!change.removed) rightSegments.push({ text: change.value, changed: Boolean(change.added) })
  }
  return { leftSegments, rightSegments }
}

function exceedsLineLimit(text: string) {
  let lines = 1
  for (const character of text) {
    if (character === '\n' && ++lines > maxLines) return true
  }
  return false
}

function linesOf(value: string) {
  if (!value) return []
  const lines = value.split('\n')
  if (value.endsWith('\n')) lines.pop()
  return lines.map((text, index) => ({ text, noNewline: index === lines.length - 1 && !value.endsWith('\n') }))
}

export function calculateSolutionDiff(original: string, content: string): SolutionDiffReply {
  if (original.length + content.length > maxCharacters || exceedsLineLimit(original) || exceedsLineLimit(content)) {
    return { status: 'error', message: '内容过长，未生成差异。完整修正结果仍可查看、复制和下载。' }
  }
  const changes = diffLines(original.replace(/\r\n?/g, '\n'), content.replace(/\r\n?/g, '\n'), {
    timeout: 1200,
    maxEditLength: 4000,
  })
  if (!changes) return { status: 'error', message: '差异计算超时或改动过多。完整修正结果仍可查看、复制和下载。' }

  const rows: SolutionDiffRow[] = []
  // 逐字比较共用时间预算；超出后保留已有的行级差异。
  const inlineDeadline = Date.now() + 500
  let leftNo = 1
  let rightNo = 1
  let added = 0
  let removed = 0
  for (let index = 0; index < changes.length;) {
    const change = changes[index]!
    if (!change.added && !change.removed) {
      for (const line of linesOf(change.value)) {
        rows.push({ kind: 'same', left: line.text, right: line.text, leftNo: leftNo++, rightNo: rightNo++, leftNoNewline: line.noNewline, rightNoNewline: line.noNewline })
      }
      index++
      continue
    }
    // jsdiff 决定差异；这里只把相邻增删块排成左右两列，不再自行计算 LCS。
    let left = ''
    let right = ''
    while (index < changes.length && (changes[index]!.added || changes[index]!.removed)) {
      const part = changes[index++]!
      if (part.removed) left += part.value
      else right += part.value
    }
    const oldLines = linesOf(left)
    const newLines = linesOf(right)
    added += newLines.length
    removed += oldLines.length
    for (let row = 0; row < Math.max(oldLines.length, newLines.length); row++) {
      const oldLine = oldLines[row]
      const newLine = newLines[row]
      rows.push({
        kind: oldLine && newLine ? 'change' : oldLine ? 'remove' : 'add',
        left: oldLine?.text ?? '', right: newLine?.text ?? '',
        leftNo: oldLine ? leftNo++ : null, rightNo: newLine ? rightNo++ : null,
        leftNoNewline: oldLine?.noNewline, rightNoNewline: newLine?.noNewline,
        ...(oldLine && newLine ? inlineSegments(oldLine.text, newLine.text, inlineDeadline) : {}),
      })
    }
  }
  return { status: 'ready', rows, added, removed }
}
