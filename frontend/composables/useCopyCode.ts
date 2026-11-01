/**
 * 给 Markdown 的 pre 块加 Fluent 风格的代码头与复制按钮。
 * SSR 不做事，hydrate 后在客户端扫描，并在 v-html 更新后重新绑定。
 */
export function useCopyCode(containerRef: Ref<HTMLElement | null | undefined>) {
  if (import.meta.server) return

  function attach(el: HTMLElement) {
    el.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
      if (pre.dataset.copyBound === '1' || pre.closest('.code-shell')) return
      pre.dataset.copyBound = '1'

      const code = pre.querySelector('code')
      let language = pre.dataset.language
        || code?.className.match(/(?:language|lang)-([\w+#.-]+)/)?.[1]
        || 'cpp'
      if (/^(text|plaintext|plain)$/i.test(language)) language = 'cpp'

      const shell = document.createElement('div')
      shell.className = 'code-shell'

      const head = document.createElement('div')
      head.className = 'code-head'

      const label = document.createElement('span')
      label.className = 'code-lang'
      label.textContent = language

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy-btn'
      btn.textContent = '复制代码'
      btn.setAttribute('aria-label', '复制代码')

      btn.addEventListener('click', async () => {
        const text = (code?.textContent ?? pre.textContent ?? '').replace(/\n$/, '')
        try {
          await navigator.clipboard.writeText(text)
          btn.textContent = '已复制'
          btn.classList.add('ok')
        } catch {
          btn.textContent = '复制失败'
          btn.classList.add('err')
        }
        setTimeout(() => {
          btn.textContent = '复制代码'
          btn.classList.remove('ok', 'err')
        }, 1500)
      })

      head.append(label, btn)
      pre.parentNode?.insertBefore(shell, pre)
      shell.append(head, pre)
    })
  }

  const run = () => {
    const el = containerRef.value
    if (el) attach(el)
  }

  let observer: MutationObserver | undefined
  let stop: (() => void) | undefined
  onMounted(() => {
    stop = watch(containerRef, el => {
      observer?.disconnect()
      if (!el) return
      run()
      observer = new MutationObserver(run)
      observer.observe(el, { childList: true, subtree: true })
    }, { immediate: true, flush: 'post' })
  })
  onBeforeUnmount(() => { stop?.(); observer?.disconnect() })
}
