import type { SolutionDiffReply } from '~/types/solutionFix'

export function useSolutionDiff() {
  const pending = ref(false)
  const reply = shallowRef<SolutionDiffReply | null>(null)
  let worker: Worker | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function dispose() {
    clearTimeout(timer)
    worker?.terminate()
    worker = undefined
  }
  function calculate(original: string, content: string) {
    dispose()
    pending.value = true
    reply.value = null
    try {
      const current = new Worker(new URL('../workers/solutionDiff.worker.ts', import.meta.url), { type: 'module' })
      worker = current
      const finish = (value: SolutionDiffReply) => {
        if (worker !== current) return
        reply.value = value
        pending.value = false
        dispose()
      }
      current.onmessage = (event: MessageEvent<SolutionDiffReply>) => finish(event.data)
      current.onerror = () => finish({ status: 'error', message: '无法启动差异计算，完整修正结果仍可查看、复制和下载。' })
      timer = setTimeout(() => finish({ status: 'error', message: '差异计算超时，完整修正结果仍可查看、复制和下载。' }), 3500)
      current.postMessage({ original, content })
    } catch {
      dispose()
      pending.value = false
      reply.value = { status: 'error', message: '浏览器无法运行差异计算，完整修正结果仍可查看、复制和下载。' }
    }
  }
  onBeforeUnmount(dispose)
  return { pending, reply, calculate }
}
