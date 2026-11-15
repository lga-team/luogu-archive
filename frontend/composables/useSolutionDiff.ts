import { buildSolutionDiff } from '~/utils/solutionDiff'
import type { SolutionDiffReply, SolutionDiffResponse } from '~/types/solutionFix'

/** 差异计算放进 Web Worker；worker 不可用时回退主线程，行为一致。 */
export function useSolutionDiff() {
  const reply = shallowRef<SolutionDiffReply | null>(null)
  const pending = ref(false)
  const error = ref('')
  let worker: Worker | null = null
  let requestId = 0
  let disposed = false
  let lastPayload: { id: number; left: string; right: string } | null = null

  function settle(id: number, value: SolutionDiffReply | null, message = '') {
    if (disposed || id !== requestId) return
    reply.value = value
    error.value = message
    pending.value = false
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker
    try {
      worker = new Worker(new URL('../workers/solutionDiff.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<SolutionDiffResponse>) => {
        const data = event.data
        if (data?.error) settle(data.id, null, data.error)
        else settle(data.id, data.reply || null, data.reply ? '' : '差异生成失败')
      }
      worker.onerror = () => {
        worker?.terminate()
        worker = null
        // worker 崩溃后立即在主线程补算，避免结果区一直停在 loading。
        if (lastPayload && pending.value) {
          try { settle(lastPayload.id, buildSolutionDiff(lastPayload.left, lastPayload.right)) }
          catch (reason) { settle(lastPayload.id, null, reason instanceof Error ? reason.message : '差异生成失败') }
        }
      }
    } catch {
      worker = null
    }
    return worker
  }

  function calculate(left: string, right: string) {
    const id = ++requestId
    reply.value = null
    error.value = ''
    pending.value = true
    lastPayload = { id, left, right }
    if (import.meta.client) {
      const instance = ensureWorker()
      if (instance) {
        instance.postMessage({ id, left, right })
        // Worker 挂掉时兜底，避免永久 loading。
        setTimeout(() => {
          if (id === requestId && pending.value && !worker) {
            try { settle(id, buildSolutionDiff(left, right)) }
            catch (reason) { settle(id, null, reason instanceof Error ? reason.message : '差异生成失败') }
          }
        }, 1200)
        return
      }
    }
    try { settle(id, buildSolutionDiff(left, right)) }
    catch (reason) { settle(id, null, reason instanceof Error ? reason.message : '差异生成失败') }
  }

  onBeforeUnmount(() => {
    disposed = true
    worker?.terminate()
    worker = null
  })
  return { reply, pending, error, calculate }
}
