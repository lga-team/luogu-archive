export type SolutionFixMode = 'local' | 'ai'
export type SolutionInputMode = 'markdown' | 'article'

export interface SolutionFixResult {
  title: string
  original: string
  content: string
  notes: string[]
  mode: SolutionFixMode
  sourceMode: SolutionInputMode
  sourceValue: string
}

export interface SolutionDiffSegment {
  text: string
  changed: boolean
}

export interface SolutionDiffRow {
  kind: 'same' | 'add' | 'remove' | 'change'
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
  leftNoNewline?: boolean
  rightNoNewline?: boolean
  leftSegments?: SolutionDiffSegment[]
  rightSegments?: SolutionDiffSegment[]
}

export type SolutionDiffReply =
  | { status: 'ready'; rows: SolutionDiffRow[]; added: number; removed: number }
  | { status: 'error'; message: string }

export interface SolutionDiffRequest {
  original: string
  content: string
}
