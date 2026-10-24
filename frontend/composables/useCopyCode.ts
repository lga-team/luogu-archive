/**
 * 给 .lg-content pre 块自动注入一键复制按钮。
 * 用法：在组件里拿到 v-html 的容器 ref，`useCopyCode(containerRef)`
 * SSR 环境不做事，hydrate 后在客户端扫 DOM。
 */
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'

const ICON_COPY = `<svg ${ICON_ATTRS}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const ICON_DONE = `<svg ${ICON_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`
const ICON_FAIL = `<svg ${ICON_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`

export function useCopyCode(containerRef: Ref<HTMLElement | null | undefined>) {
  if (import.meta.server) return

  function attach(el: HTMLElement) {
    el.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
      if (pre.dataset.copyBound === '1') return
      pre.dataset.copyBound = '1'

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy-btn'
      btn.setAttribute('aria-label', '复制代码')
      btn.title = '复制代码'
      btn.innerHTML = ICON_COPY
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')
        const text = (code?.textContent ?? pre.textContent ?? '').replace(/\n$/, '')
        let ok = true
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          ok = false
        }
        btn.innerHTML = ok ? ICON_DONE : ICON_FAIL
        btn.classList.add(ok ? 'ok' : 'err')
        btn.setAttribute('aria-label', ok ? '已复制' : '复制失败')
        setTimeout(() => {
          btn.innerHTML = ICON_COPY
          btn.classList.remove('ok', 'err')
          btn.setAttribute('aria-label', '复制代码')
        }, 1500)
      })
      // pre 自身横向滚动，按钮挂在它外面，滚动时保持不动
      let host = pre.parentElement
      if (!host?.classList.contains('code-block-wrap')) {
        host = document.createElement('div')
        host.className = 'code-block-wrap'
        pre.parentNode?.insertBefore(host, pre)
        host.appendChild(pre)
      }
      host.appendChild(btn)
    })
  }

  // 容器在数据到达后才渲染，所以监听 ref 本身而不是只在 onMounted 绑一次；
  // 容器就绪后再用 MutationObserver 跟进 v-html 的后续变动。
  let observer: MutationObserver | null = null

  function bind(el: HTMLElement | null | undefined) {
    observer?.disconnect()
    observer = null
    if (!el) return
    attach(el)
    observer = new MutationObserver(() => attach(el))
    observer.observe(el, { childList: true, subtree: true })
  }

  watch(containerRef, bind, { immediate: true })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })
}
