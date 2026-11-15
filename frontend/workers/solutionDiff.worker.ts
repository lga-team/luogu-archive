/// <reference lib="webworker" />
import { buildSolutionDiff } from '../utils/solutionDiff'
import type { SolutionDiffRequest, SolutionDiffResponse } from '../types/solutionFix'

self.onmessage = (event: MessageEvent<SolutionDiffRequest>) => {
  const { id, left, right } = event.data || ({} as SolutionDiffRequest)
  try {
    const reply = buildSolutionDiff(left || '', right || '')
    const response: SolutionDiffResponse = { id, reply }
    self.postMessage(response)
  } catch (error) {
    const response: SolutionDiffResponse = { id, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
