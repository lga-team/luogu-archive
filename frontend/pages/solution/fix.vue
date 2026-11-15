<script setup lang="ts">
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, FilePenLine, Link2, LoaderCircle, LogIn } from 'lucide-vue-next'
import { parseSolutionArticleId, readSolutionFixStream } from '~/utils/solutionFix'

definePageMeta({ layout: 'default' })
useHead({ title: '题解修 - 洛谷档案馆' })

const api = useApi()
const auth = useAuthStore()
const apiBase = useApiBase()
const diff = useSolutionDiff()

const fixMode = ref('local')
const sourceText = ref('')
const articleLink = ref('')
const result = shallowRef<string | null>(null)
const busy = ref(false)
const stage = ref('')
const errorText = ref('')
const copyState = ref<'idle' | 'success' | 'error'>('idle')
const onlyChanges = ref(false)
const diffNav = ref({ current: 0, total: 0 })
const diffViewRef = ref<any>(null)
const modeOptions = [
  { value: 'local', label: '本地修正' },
  { value: 'ai', label: 'AI 修正' },
]

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
const loginLink = computed(() => ({ path: '/login', query: { redirect: '/solution/fix' } }))

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
  const read = () => api<{ content_md: string }>(`/article/${id}`, { signal, retry: 0, timeout: 10000 })
  try { return await read() }
  catch (error) { if (statusOf(error) !== 404) throw error }
  signal.throwIfAborted()
  stage.value = '正在提交文章保存任务'
  await api('/save', { method: 'POST', body: { content_type: 'article', id }, signal, retry: 0 })
  signal.throwIfAborted()
  stage.value = '等待文章收录'
  for (let attempt = 0; attempt < 24; attempt += 1) {
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
      const response = await fetch(`${apiBase}/api/v1/solution-fix/ai`, {
        method: 'POST',
        credentials: useApiCredentials(),
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({ content: input }),
      })
      content = await readSolutionFixStream(response, {
        model: value => { stage.value = `AI 正在修正（${value}）` },
        stage: value => { stage.value = value },
      })
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
  request += 1
  controller?.abort()
  controller = undefined
  errorText.value = '已停止接收。已提交的任务可能仍在后台继续。'
  busy.value = false
}
function editAgain() {
  clearTimeout(copyTimer)
  copyState.value = 'idle'
  result.value = null
  onlyChanges.value = false
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
onBeforeUnmount(() => { request += 1; controller?.abort(); clearTimeout(copyTimer) })
</script>

<template>
  <div class="page fix-page">
    <PageHeader title="题解修" description="修正题解的 Markdown 格式，保留洛谷扩展语法；AI 模式需要登录。" eyebrow="Solution fix">
      <template #icon><FilePenLine :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>

    <Transition name="fix-state" mode="out-in" @after-enter="focusState">
      <!-- 输入 -->
      <div v-if="phase === 'input'" key="input" class="fix-state">
        <form class="card fix-form" aria-label="修正输入" @submit.prevent="runFix">
          <div class="card__body stack">
            <div class="fix-address">
              <Link2 :size="17" class="fix-address__icon" aria-hidden="true" />
              <FInput
                v-model="articleLink"
                placeholder="粘贴洛谷文章地址或文章 ID"
                aria-label="粘贴文章地址"
                data-state-focus
              />
            </div>
            <div class="fix-or" aria-hidden="true"><span>或</span></div>
            <div class="stack stack--xs">
              <FTextarea v-model="sourceText" :rows="12" placeholder="粘贴题解 Markdown" aria-label="粘贴题解 Markdown" />
            </div>
            <p v-if="bothProvided || errorText" class="field-error" role="alert">
              {{ bothProvided ? '请只保留文章地址或 Markdown 中的一种。' : errorText }}
            </p>
          </div>
          <div class="fix-options">
            <FRadioGroup v-model="fixMode" :options="modeOptions" orientation="horizontal" aria-label="修正方式" />
            <NuxtLink v-if="aiNeedsLogin" :to="loginLink" class="fix-login">
              <LogIn :size="15" aria-hidden="true" />登录后使用 AI
            </NuxtLink>
            <FButton type="submit" appearance="primary" :disabled="!canRun" class="fix-run">
              <template #start><FilePenLine v-if="!busy" :size="16" aria-hidden="true" /></template>开始修正
            </FButton>
          </div>
        </form>
      </div>

      <!-- 进度 -->
      <div v-else-if="phase === 'progress'" key="progress" class="fix-state">
        <section class="card fix-progress" aria-label="修正进度">
          <p class="fix-progress-label" role="status" tabindex="-1" data-state-focus>
            <LoaderCircle :size="20" class="spin" aria-hidden="true" />{{ busy ? stage : '正在生成差异' }}
          </p>
          <FButton v-if="busy" appearance="subtle" size="small" @click="stopReceiving">停止接收</FButton>
        </section>
      </div>

      <!-- 结果 -->
      <div v-else key="result" class="fix-state">
        <section class="card fix-result" aria-label="修正结果">
          <div class="card__header fix-result-head">
            <h2 class="card__title" tabindex="-1" data-state-focus>差异</h2>
            <div class="cluster fix-result-actions">
              <FButton appearance="subtle" size="small" @click="editAgain">
                <template #start><ArrowLeft :size="15" aria-hidden="true" /></template>返回编辑
              </FButton>
              <FButton appearance="primary" size="small" @click="copyResult">
                <template #start><Check v-if="copyState === 'success'" :size="15" aria-hidden="true" /><Copy v-else :size="15" aria-hidden="true" /></template>
                {{ copyState === 'success' ? '已复制' : '复制修正后的 Markdown' }}
              </FButton>
            </div>
            <span v-if="copyState === 'success'" class="sr-only" role="status">已复制完整修正结果</span>
          </div>
          <p v-if="copyState === 'error'" class="field-error fix-result-message" role="alert">复制失败，请检查浏览器的剪贴板权限。</p>

          <template v-if="successfulDiff">
            <div class="fix-diff-bar">
              <p v-if="!successfulDiff.added && !successfulDiff.removed" class="field-help">没有检测到差异。</p>
              <template v-else>
                <FCheckbox v-model="onlyChanges" label="仅显示差异" />
                <span v-if="diffNav.total" class="field-help">{{ diffNav.current }} / {{ diffNav.total }} 处</span>
              </template>
              <div v-if="diffNav.total" class="cluster">
                <FButton appearance="subtle" size="small" icon-only aria-label="上一处差异" @click="diffViewRef?.navigate(-1)"><ChevronLeft :size="15" aria-hidden="true" /></FButton>
                <FButton appearance="subtle" size="small" icon-only aria-label="下一处差异" @click="diffViewRef?.navigate(1)"><ChevronRight :size="15" aria-hidden="true" /></FButton>
              </div>
            </div>
            <SolutionDiffView
              v-if="successfulDiff.added || successfulDiff.removed"
              ref="diffViewRef"
              :rows="successfulDiff.rows"
              :only-changes="onlyChanges"
              max-height="620px"
              @navigation="diffNav = $event"
            />
          </template>
          <p v-else-if="diff.error" class="field-error fix-result-message" role="alert">未能生成差异（{{ diff.error }}），仍可复制完整修正结果。</p>
          <p v-else class="field-help fix-result-message" role="status">正在生成差异…</p>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fix-page { display: flex; flex-direction: column; gap: 16px; }
.fix-state { min-width: 0; }
.fix-state-enter-active, .fix-state-leave-active { transition: opacity 160ms ease, transform 160ms cubic-bezier(.22, 1, .36, 1); }
.fix-state-enter-from, .fix-state-leave-to { opacity: 0; transform: translateY(6px); }
.fix-form { overflow: hidden; }
.fix-form > .card__body { padding: 24px; }
.fix-address { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fix-address__icon { flex: 0 0 auto; color: var(--colorNeutralForeground3); }
.fix-address :deep(.f-input) { flex: 1 1 auto; min-width: 0; }
.fix-or { display: flex; align-items: center; gap: 12px; color: var(--colorNeutralForeground3); font-size: 13px; }
.fix-or::before, .fix-or::after { content: ''; flex: 1; height: 1px; background: var(--colorNeutralStroke2); }
.fix-form :deep(.f-textarea) { width: 100%; font-family: var(--fontFamilyMonospace); font-size: 13px; }
.fix-options {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px 18px;
  padding: 14px 24px; border-top: 1px solid var(--colorNeutralStroke2);
}
.fix-run { margin-left: auto; min-width: 112px; }
.fix-login { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.fix-progress { display: flex; align-items: center; justify-content: center; gap: 14px; min-height: 160px; padding: 30px 16px; }
.fix-progress-label { display: inline-flex; align-items: center; gap: 10px; margin: 0; color: var(--colorNeutralForeground2); }
.spin { color: var(--colorBrandForeground1); animation: fix-spin 900ms linear infinite; }
@keyframes fix-spin { to { transform: rotate(360deg); } }
.fix-result { overflow: hidden; }
.fix-result-head { flex-wrap: wrap; }
.fix-result-actions { margin-left: auto; }
.fix-result-message { padding: 12px 20px 20px; }
.fix-diff-bar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 10px 20px; border-top: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground2);
}
.fix-diff-bar p { margin: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
  .fix-state-enter-active, .fix-state-leave-active { transition: none; }
  .spin { animation: none; }
}
@media (max-width: 680px) {
  .fix-form > .card__body { padding: 16px; }
  .fix-options { padding: 12px 16px; }
  .fix-run { margin-left: 0; width: 100%; }
  .fix-result-actions { width: 100%; margin-left: 0; }
  .fix-diff-bar { padding: 10px 14px; }
}
</style>
