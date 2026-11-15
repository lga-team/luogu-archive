export type SolutionDiffKind = 'same' | 'add' | 'remove' | 'change'

export interface DiffSegment {
  text: string
  changed: boolean
}

export interface SolutionDiffRow {
  kind: SolutionDiffKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
  leftNoNewline?: boolean
  rightNoNewline?: boolean
  leftSegments?: DiffSegment[]
  rightSegments?: DiffSegment[]
}

export interface SolutionDiffReply {
  status: 'ready'
  rows: SolutionDiffRow[]
  added: number
  removed: number
}

export interface SolutionDiffRequest {
  id: number
  left: string
  right: string
}

export interface SolutionDiffResponse {
  id: number
  reply?: SolutionDiffReply
  error?: string
}
