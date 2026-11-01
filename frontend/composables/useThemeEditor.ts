import { applyTheme, defaultTheme, normalizeTheme, parseThemeId, prepareTheme, readTheme, saveTheme, type SavedTheme, type ThemeResult, type ThemeConfig } from '~/lib/luoguTheme'

const copyTheme = (value: SavedTheme): SavedTheme => JSON.parse(JSON.stringify(value))
export function useThemeEditor() {
  const api = useApi()
  const draft = ref<SavedTheme>(defaultTheme())
  const baseline = ref(JSON.stringify(draft.value))
  const link = ref('')
  const busy = ref(false)
  const message = ref('')
  const error = ref('')
  const imageFallback = ref<SavedTheme | null>(null)
  const preparedImage = ref('')
  const imageInput = ref('')
  const imageEnabled = ref(false)
  const rememberedImage = ref('')
  const operation = shallowRef<AbortController | null>(null)
  const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)
  let active = false
  let imageRequest = 0
  const config = computed(() => draft.value.config)
  const bodyConfig = computed(() => config.value.lBody)
  const imageOptions = computed(() => bodyConfig.value.midOpts)

  function replace(next: SavedTheme) {
    draft.value = copyTheme(next)
    imageInput.value = next.config.lBody.image
    imageEnabled.value = Boolean(next.config.lBody.image)
    rememberedImage.value = next.config.lBody.image
  }
  function preview() {
    if (!active) return
    const next = copyTheme(draft.value)
    next.config.lBody.image = preparedImage.value
    applyTheme(next)
  }
  onMounted(() => {
    active = true
    const saved = readTheme()
    baseline.value = JSON.stringify(saved)
    preparedImage.value = saved.config.lBody.image
    replace(saved)
    preview()
  })
  onBeforeUnmount(() => {
    active = false
    imageRequest++
    operation.value?.abort()
    // 草稿预览不能泄漏到其他页面，离开时恢复最后保存的配置。
    applyTheme(readTheme())
  })
  watch([() => draft.value.enabled, () => draft.value.config.lBody.image], async ([enabled, image]) => {
    if (!active) return
    const current = ++imageRequest
    if (!enabled || !image) { preparedImage.value = ''; return }
    const next = copyTheme(draft.value)
    try {
      await prepareTheme(next)
      if (active && current === imageRequest) preparedImage.value = next.config.lBody.image
    } catch (reason: any) { if (active && current === imageRequest) error.value = reason.message }
  })
  watch([draft, preparedImage], preview, { deep: true })
  function update(mutator: (theme: SavedTheme) => void) { mutator(draft.value); message.value = ''; error.value = '' }
  function body<K extends keyof ThemeConfig['lBody']>(key: K, value: ThemeConfig['lBody'][K]) { update(theme => { theme.config.lBody[key] = value }) }
  function opts<K extends keyof ThemeConfig['lBody']['midOpts']>(key: K, value: ThemeConfig['lBody']['midOpts'][K]) { update(theme => { theme.config.lBody.midOpts[key] = value }) }

  async function importLink(refresh = false) {
    if (busy.value) return
    let id: number
    try { id = parseThemeId(link.value) } catch (reason: any) { error.value = reason.message; return }
    const controller = new AbortController()
    operation.value = controller
    busy.value = true; error.value = ''; imageFallback.value = null; message.value = '正在获取主题…'
    try {
      let result = await api<ThemeResult>('/themes/import', { method: 'POST', body: { id, refresh }, signal: controller.signal })
      const deadline = Date.now() + 900000
      while (result.status === 'pending') {
        if (Date.now() > deadline) throw Error('等待超时，请稍后重试')
        message.value = '主题抓取排队中…'
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve() }, 2000)
          controller.signal.addEventListener('abort', abort, { once: true })
          if (controller.signal.aborted) abort()
        })
        result = await api<ThemeResult>('/themes/' + id, { signal: controller.signal })
      }
      if (result.status !== 'ready') throw Error(result.error || '主题导入失败')
      const next: SavedTheme = { name: result.name, config: normalizeTheme(result.config), enabled: true, sourceId: id, author: result.author_name }
      message.value = '正在加载主题背景…'
      try { await prepareTheme(next) }
      catch (reason) { if (active && !controller.signal.aborted) imageFallback.value = next; throw reason }
      if (!active || controller.signal.aborted) return
      preparedImage.value = next.config.lBody.image
      replace(next); applyTheme(next); message.value = '已导入：' + next.name
    } catch (reason: any) {
      if (active) { if (reason.name !== 'AbortError') error.value = reason?.data?.message || reason.message || '主题导入失败'; message.value = reason.name === 'AbortError' ? '已取消等待' : '' }
    } finally { if (operation.value === controller) operation.value = null; if (active) busy.value = false }
  }
  async function save() {
    if (busy.value) return
    busy.value = true; error.value = ''; message.value = ''
    const next = copyTheme(draft.value)
    try {
      await prepareTheme(next)
      if (!active) return
      saveTheme(next); baseline.value = JSON.stringify(next); preparedImage.value = next.config.lBody.image; message.value = '主题已保存'
    } catch (reason: any) { if (active) error.value = reason.message || '保存失败，浏览器存储可能不可用' }
    finally { if (active) busy.value = false }
  }
  async function importJson(event: Event) {
    const input = event.target as HTMLInputElement
    const selected = input.files?.[0]
    input.value = ''
    if (!selected || busy.value) return
    error.value = ''; message.value = ''; busy.value = true
    try {
      if (selected.size > 65536) throw Error('主题文件不能超过 64KB')
      const raw = JSON.parse(await selected.text())
      const next = { name: String(raw.name || '导入主题').slice(0, 100), config: normalizeTheme(raw.config ?? raw), enabled: true }
      await prepareTheme(next)
      if (!active) return
      preparedImage.value = next.config.lBody.image; replace(next); message.value = 'JSON 已导入'
    } catch (reason: any) { if (active) error.value = reason.message || 'JSON 导入失败' }
    finally { if (active) busy.value = false }
  }
  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: draft.value.name, config: draft.value.config }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'luogu-theme.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function cancel() {
    const saved = readTheme()
    baseline.value = JSON.stringify(saved); replace(saved); preparedImage.value = saved.config.lBody.image; applyTheme(saved)
    message.value = '已取消修改'; error.value = ''; imageFallback.value = null
  }
  function reset() { replace(defaultTheme()); message.value = ''; error.value = ''; imageFallback.value = null }
  function importWithoutImage() {
    if (!imageFallback.value) return
    const next = copyTheme(imageFallback.value)
    next.config.lBody.image = ''
    preparedImage.value = ''; replace(next); applyTheme(next); imageFallback.value = null; error.value = ''; message.value = '已导入：' + next.name + '（不使用背景图片）'
  }
  function setImageEnabled(value: boolean) { imageEnabled.value = value; body('image', value ? rememberedImage.value : '') }
  function commitImage() {
    try {
      const value = imageInput.value.trim()
      normalizeTheme({ lBody: { image: value } })
      rememberedImage.value = value; body('image', imageEnabled.value ? value : '')
    } catch (reason: any) { error.value = reason.message }
  }
  function clearImage() { rememberedImage.value = ''; imageInput.value = ''; body('image', '') }
  function setSize(index: number, value: string | number | undefined) {
    const size = imageOptions.value.size.split(/\s+/)
    size[index] = String(Math.max(0, Math.min(9999, Number(value) || 0)))
    opts('size', (size[0] || '0') + ' ' + (size[1] || '0'))
  }
  return { draft, config, bodyConfig, imageOptions, link, busy, message, error, imageFallback, imageInput, imageEnabled, operation, dirty, update, body, opts, importLink, save, importJson, exportJson, cancel, reset, importWithoutImage, setImageEnabled, commitImage, clearImage, setSize }
}
