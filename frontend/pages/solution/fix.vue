<script setup lang="ts">
import { ArrowLeft, Check, Copy, Link2, LoaderCircle, LogIn } from 'lucide-vue-next'
import { Button, Input, RadioGroup, RadioGroupItem, Textarea } from '~/components/ui'
import SolutionDiffView from '~/components/SolutionDiffView.vue'
import { parseSolutionArticleId, readSolutionFixStream } from '~/utils/solutionFix'
import { settingsAuthRoute } from '~/utils/settingsAuth'

definePageMeta({ layout: 'default' })
useHead({ title: '题解修 - 洛谷档案馆' })

const api = useApi()
const auth = useAuthStore()
const config = useRuntimeConfig()
const diff = useSolutionDiff()
const fixMode = ref('local')
const sourceText = ref('')
const articleLink = ref('')
const result = shallowRef<string | null>(null)
const busy = ref(false)
const stage = ref('')
const errorText = ref('')
const copyState = ref<'idle' | 'success' | 'error'>('idle')
let controller: AbortController | undefined
let request = 0
let copyTimer: ReturnType<typeof setTimeout> | undefined

const hasArticle = computed(() => Boolean(articleLink.value.trim()))
const hasMarkdown = computed(() => Boolean(sourceText.value.trim()))
const bothProvided = computed(() => hasArticle.value && hasMarkdown.value)
const aiNeedsLogin = computed(() => fixMode.value === 'ai' && !auth.isLoggedIn)
const canRun = computed(() => !busy.value && !aiNeedsLogin.value && hasArticle.value !== hasMarkdown.value)
const phase = computed(() => busy.value || (result.value !== null && diff.pending.value)
  ? 'progress'
  : result.value === null ? 'input' : 'result')
const successfulDiff = computed(() => diff.reply.value?.status === 'ready' ? diff.reply.value : null)
const loginLink = settingsAuthRoute('login', '/solution/fix')

function messageOf(error: unknown) {
  const value = error as { data?: { message?: string }; message?: string }
  return value?.data?.message || value?.message || '修正失败，请稍后重试。'
}
function statusOf(error: unknown) {
  const value = error as { statusCode?: number; response?: { status?: number } }
  return value?.statusCode || value?.response?.status
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}
async function loadArticle(id: string, signal: AbortSignal) {
  const read = () => api<{ content_md: string }>('/article/' + id, { signal, retry: 0, timeout: 10000 })
  try { return await read() }
  catch (error) { if (statusOf(error) !== 404) throw error }
  signal.throwIfAborted()
  stage.value = '正在提交文章保存任务'
  await api('/save', { method: 'POST', body: { content_type: 'article', id }, signal, retry: 0 })
  signal.throwIfAborted()
  stage.value = '等待文章收录'
  for (let attempt = 0; attempt < 24; attempt++) {
    await delay(1500, signal)
    try { return await read() }
    catch (error) { if (statusOf(error) !== 404) throw error }
  }
  throw new Error('文章暂未收录完成，请稍后重试。')
}
async function runFix() {
  if (phase.value !== 'input' || !canRun.value) return
  const mode = fixMode.value
  let input = sourceText.value
  let id = ''
  if (hasArticle.value) {
    try { id = parseSolutionArticleId(articleLink.value) }
    catch (error) { errorText.value = messageOf(error); return }
  }

  const current = ++request
  controller = new AbortController()
  const signal = controller.signal
  stage.value = id ? '读取文章档案' : mode === 'ai' ? 'AI 正在修正' : '正在修正格式'
  busy.value = true
  errorText.value = ''
  try {
    if (id) input = (await loadArticle(id, signal)).content_md
    if (current !== request || signal.aborted) return
    if (!input.trim()) throw new Error('文章正文为空，无法进行修正。')
    let content: string
    if (mode === 'ai') {
      stage.value = 'AI 正在修正'
      const response = await fetch(String(config.public.apiBaseUrl || '').replace(/\/$/, '') + '/api/v1/solution-fix/ai', {
        method: 'POST', credentials: 'include', signal,
        headers: { 'Content-Type': 'application/json', ...(auth.accessToken ? { Authorization: 'Bearer ' + auth.accessToken } : {}) },
        body: JSON.stringify({ content: input }),
      })
      content = await readSolutionFixStream(response, { model: () => {}, thought: () => {}, content: () => {} })
    } else {
      stage.value = '正在修正格式'
      const response = await api<{ content: string }>('/solution-fix/local', {
        method: 'POST', body: { content: input }, signal, retry: 0,
      })
      if (typeof response.content !== 'string') throw new Error('修正接口未返回有效内容。')
      content = response.content
    }
    if (current !== request || signal.aborted) return
    result.value = content
    diff.calculate(input, content)
  } catch (error) {
    if (current !== request || signal.aborted) return
    errorText.value = messageOf(error)
  } finally {
    if (current === request) { busy.value = false; controller = undefined }
  }
}
function stopReceiving() {
  request++
  controller?.abort()
  controller = undefined
  errorText.value = '已停止接收。已提交的任务可能仍在后台继续。'
  busy.value = false
}
function editAgain() {
  clearTimeout(copyTimer)
  copyState.value = 'idle'
  result.value = null
}
async function copyResult() {
  const snapshot = result.value
  const current = request
  if (snapshot === null || phase.value !== 'result') return
  clearTimeout(copyTimer)
  let nextState: 'success' | 'error' = 'success'
  try { await navigator.clipboard.writeText(snapshot) }
  catch { nextState = 'error' }
  if (current !== request || result.value !== snapshot) return
  copyState.value = nextState
  copyTimer = setTimeout(() => { copyState.value = 'idle' }, 2200)
}
function focusState(element: Element) {
  if (element.contains(document.activeElement)) return
  element.querySelector<HTMLElement>('[data-state-focus]')?.focus({ preventScroll: true })
}
watch([articleLink, sourceText, fixMode], () => { errorText.value = '' })
onMounted(() => { if (!auth.initialized) void auth.tryRefresh() })
onBeforeUnmount(() => { request++; controller?.abort(); clearTimeout(copyTimer) })
</script>

<template>
  <div class="archive-ui fix-page">
    <ArchivePageHeader title="题解修" description="修正题解的 Markdown 格式" icon="solution" />

    <Transition name="fix-state" mode="out-in" @after-enter="focusState">
      <div v-if="phase === 'input'" key="input" class="fix-state">
        <form class="archive-card fix-form" aria-label="修正输入" @submit.prevent="runFix">
          <div class="fix-fields">
            <label class="fix-address">
              <Link2 :size="17" aria-hidden="true" />
              <Input v-model="articleLink" aria-label="粘贴文章地址" placeholder="粘贴文章地址" autocomplete="off" :spellcheck="false" :aria-describedby="bothProvided ? 'fix-input-message' : undefined" :data-state-focus="hasArticle ? '' : undefined" />
            </label>
            <div class="fix-or" aria-hidden="true"><span>或</span></div>
            <Textarea v-model="sourceText" class="fix-editor" aria-label="粘贴题解 Markdown" placeholder="粘贴题解 Markdown" :spellcheck="false" :aria-describedby="bothProvided ? 'fix-input-message' : undefined" :data-state-focus="!hasArticle ? '' : undefined" />
            <p v-if="bothProvided || errorText" id="fix-input-message" class="fix-message" role="alert">{{ bothProvided ? '请只保留文章地址或 Markdown 中的一种。' : errorText }}</p>
          </div>
          <div class="fix-options">
            <RadioGroup v-model="fixMode" class="fix-mode" aria-label="修正方式">
              <label><RadioGroupItem value="local" aria-label="本地修正" />本地修正</label>
              <label><RadioGroupItem value="ai" aria-label="AI 修正" />AI 修正</label>
            </RadioGroup>
            <NuxtLink v-if="aiNeedsLogin" :to="loginLink" class="fix-login"><LogIn :size="15" aria-hidden="true" />登录后使用 AI</NuxtLink>
            <Button type="submit" class="fix-primary fix-run" :disabled="!canRun">开始修正</Button>
          </div>
        </form>
      </div>

      <div v-else-if="phase === 'progress'" key="progress" class="fix-state">
        <section class="archive-card fix-progress" aria-label="修正进度">
          <p class="fix-progress-label" role="status" tabindex="-1" data-state-focus><LoaderCircle :size="20" class="fix-spinner" aria-hidden="true" />{{ busy ? stage : '正在生成差异' }}</p>
          <Button v-if="busy" type="button" variant="ghost" size="sm" @click="stopReceiving">停止接收</Button>
        </section>
      </div>

      <div v-else key="result" class="fix-state">
        <section class="archive-card fix-result" aria-labelledby="fix-result-title">
          <div class="fix-result-head">
            <h2 id="fix-result-title" tabindex="-1" data-state-focus>差异</h2>
            <div class="fix-result-actions">
              <Button type="button" variant="ghost" size="sm" @click="editAgain"><ArrowLeft :size="15" aria-hidden="true" />返回编辑</Button>
              <Button type="button" class="fix-primary fix-copy" size="sm" @click="copyResult"><Check v-if="copyState === 'success'" :size="15" aria-hidden="true" /><Copy v-else :size="15" aria-hidden="true" />{{ copyState === 'success' ? '已复制' : '复制修正后的 Markdown' }}</Button>
            </div>
            <span v-if="copyState === 'success'" class="fix-sr-only" role="status">已复制完整修正结果</span>
          </div>
          <p v-if="copyState === 'error'" class="fix-message fix-result-message" role="alert">复制失败，请检查浏览器的剪贴板权限。</p>
          <template v-if="successfulDiff">
            <p v-if="!successfulDiff.added && !successfulDiff.removed" class="fix-result-message">没有检测到差异。</p>
            <SolutionDiffView v-else :rows="successfulDiff.rows" />
          </template>
          <p v-else class="fix-result-message" role="status">未能生成差异，仍可复制完整修正结果。</p>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fix-page { display: grid; gap: 20px; width: min(100%, 1180px); min-width: 0; margin: 0 auto; }
.fix-state { display: grid; grid-template-rows: 1fr; min-width: 0; }
.fix-state-enter-active, .fix-state-leave-active { transition: grid-template-rows 160ms cubic-bezier(.22, 1, .36, 1), opacity 150ms ease; }
.fix-state-enter-active > *, .fix-state-leave-active > * { min-height: 0; overflow: hidden; }
.fix-state-enter-from, .fix-state-leave-to { grid-template-rows: 0fr; opacity: 0; }
.fix-form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0; min-width: 0; }
.fix-fields { display: grid; gap: 16px; min-width: 0; padding: 24px; }
.fix-address { position: relative; display: block; min-width: 0; }
.fix-address > svg { position: absolute; top: 50%; left: 12px; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.fix-address :deep(.archive-input) { padding-left: 38px; }
.fix-or { display: flex; align-items: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
.fix-or::before, .fix-or::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.fix-page .fix-editor { width: 100%; min-height: 270px; resize: vertical; padding: 12px 14px; caret-color: var(--link); font: 14px/1.75 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.fix-options { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; min-width: 0; padding: 14px 24px; border-top: 1px solid var(--border); }
.fix-mode { display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 14px; }
.fix-mode label { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; }
.archive-ui .fix-primary { background: var(--link); color: #fff; }
.archive-ui .fix-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--link) 88%, #000); color: #fff; }
.fix-run { min-width: 112px; margin-left: auto; }
.fix-login { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.fix-message { margin: 0; color: var(--lg-red); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.fix-progress { align-items: center; justify-content: center; gap: 12px; padding: 36px 16px; min-height: 150px; }
.fix-progress-label { display: inline-flex; align-items: center; gap: 10px; margin: 0; }
.fix-spinner { color: var(--link); animation: fix-spin 900ms linear infinite; }
@keyframes fix-spin { to { transform: rotate(360deg); } }
.fix-result { display: block; min-width: 0; padding: 0; }
.fix-result-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; min-height: 65px; padding: 14px 20px; }
.fix-result-head h2 { margin: 0; font-size: 17px; font-weight: 600; }
.fix-result-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-left: auto; min-width: 0; }
.archive-ui .fix-copy { width: 204px; max-width: 100%; }
.fix-result-message { margin: 0; padding: 12px 20px 20px; color: var(--text-muted); font-size: 13px; }
.fix-result-message.fix-message { color: var(--lg-red); }
.fix-result :deep(.solution-diff-scroll) { min-height: 0; }
.fix-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
  .fix-state-enter-active, .fix-state-leave-active { transition: none; }
  .fix-spinner { animation: none; }
}
@media (max-width: 640px) {
  .fix-fields { padding: 16px; }
  .fix-options { padding: 12px 16px; }
  .fix-page .fix-editor { min-height: 230px; }
  .fix-result-head { padding: 12px 16px; }
}
</style>
