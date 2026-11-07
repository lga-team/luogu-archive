import { calculateSolutionDiff } from '../utils/solutionDiff'
import type { SolutionDiffReply, SolutionDiffRequest } from '../types/solutionFix'

self.onmessage = (event: MessageEvent<SolutionDiffRequest>) => {
  let reply: SolutionDiffReply
  try { reply = calculateSolutionDiff(event.data.original, event.data.content) }
  catch { reply = { status: 'error', message: '差异计算失败，完整修正结果仍可查看、复制和下载。' } }
  self.postMessage(reply)
}
