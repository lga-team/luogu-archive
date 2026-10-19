<script setup lang="ts">
import { ExternalLink, RefreshCw } from '@lucide/vue'

const api = useApi()
const route = useRoute()
const { fromNow } = useTime()

interface ProblemItem {
  pid: string
  title: string
  difficulty: string | null
  tags: Array<number | string>
  solution_open: boolean
}

interface ProblemDifficultyBucket {
  items: ProblemItem[]
  total: number
}

const PREVIEW_LIMIT = 20

// 总览：每档前 20 条 + 该档总数
// 题目库接口较慢时不阻塞页面打开，先显示加载窗口。
const { data, pending: listPending } = useLazyAsyncData('problem-list', () =>
  api<Record<string, ProblemDifficultyBucket>>('/problem/list', {
    query: { preview_limit: PREVIEW_LIMIT },
  }),
  { server: false },
)
const { data: lastCrawled } = useLazyAsyncData('problem-list-last-crawled', () =>
  api<{ last_crawled_at: string | null }>('/last-crawled?type=problem_catalog'),
  { server: false },
)

const saveState = ref<'idle' | 'pending' | 'success' | 'failed' | 'cooldown' | 'captcha'>('idle')
const saveMessage = ref('')
const captchaToken = ref('')
const showCaptcha = ref(false)
const captchaRef = ref<any>(null)

const relTime = computed(() =>
  lastCrawled.value?.last_crawled_at ? fromNow(lastCrawled.value.last_crawled_at) : '未知',
)

async function saveProblemList() {
  if (saveState.value === 'pending') return
  saveState.value = 'pending'
  saveMessage.value = '排队中...'
  try {
    const resp = await api<{ task_id: string; merged: boolean; status: string }>('/save', {
      method: 'POST',
      body: {
        content_type: 'problem',
        id: 'list',
        captcha_token: captchaToken.value || undefined,
      },
    })
    showCaptcha.value = false
    captchaToken.value = ''
    captchaRef.value?.reset?.()
    saveState.value = 'success'
    saveMessage.value = resp.merged ? '已合并到进行中的任务' : '已派发，请稍后刷新'
    setTimeout(() => {
      saveState.value = 'idle'
      saveMessage.value = ''
    }, 3000)
  } catch (e: any) {
    const code = e?.data?.error_code
    if (code === 'captcha_required') {
      saveState.value = 'captcha'
      showCaptcha.value = true
      saveMessage.value = '请完成人机验证'
      await nextTick()
      try {
        captchaToken.value = await captchaRef.value?.getToken?.()
        await saveProblemList()
      } catch (err: any) {
        saveMessage.value = err?.message || '请先完成人机验证'
      }
    } else if (code === 'rate_limited') {
      saveState.value = 'cooldown'
      const s = e?.data?.data?.retry_after_sec || 30
      saveMessage.value = `冷却中 ${s}s`
      setTimeout(() => { saveState.value = 'idle' }, s * 1000)
    } else {
      saveState.value = 'failed'
      saveMessage.value = e?.data?.message || '失败'
      setTimeout(() => { saveState.value = 'idle' }, 3000)
    }
  }
}

async function onCaptchaVerified(token: string) {
  if (saveState.value !== 'captcha') return
  captchaToken.value = token
  await saveProblemList()
}

// 按洛谷难度顺序排序
const diffOrder = [
  '入门', '普及-', '普及', '普及+/提高-',
  '提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS',
  '暂无评定',
]
const sortedKeys = computed(() => {
  if (!data.value) return []
  return Object.keys(data.value).sort((a, b) => {
    const ai = diffOrder.indexOf(a)
    const bi = diffOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
})

// 难度 → 洛谷色名（配合 lg-name 的 data-color 上色）
const diffColor: Record<string, string> = {
  '入门': 'Red',
  '普及-': 'Orange',
  '普及': 'Yellow',
  '普及/提高-': 'Yellow',
  '普及+/提高-': 'Green',
  '普及+/提高': 'Green',
  '提高': 'Cyan',
  '提高+/省选-': 'Blue',
  '省选/NOI-': 'Purple',
  'NOI/NOI+/CTS': 'Black',
  'NOI/NOI+/CTSC': 'Black',
  'unknown_8': 'Black',
  '暂无评定': 'Gray',
}

const saveButtonCls = computed(() => ({
  success: 'text-[var(--lg-green)] border-[var(--lg-green)]',
  failed: 'text-[var(--lg-red)] border-[var(--lg-red)]',
  cooldown: 'text-[var(--lg-orange)] border-[var(--lg-orange)]',
  captcha: 'text-[var(--lg-orange)] border-[var(--lg-orange)]',
}[saveState.value] ?? ''))

// 通过 ?difficulty=xxx 切到单档全列表视图
const selectedDiff = computed<string | null>(() => {
  const d = route.query.difficulty
  return typeof d === 'string' && d.length > 0 ? d : null
})

// 单档全量数据：仅当 selectedDiff 非空时拉取，切换 query 时自动重拉
const { data: fullList, pending: fullPending } = useLazyAsyncData(
  'problem-list-full',
  () => {
    if (!selectedDiff.value) return Promise.resolve<ProblemItem[]>([])
    return api<ProblemItem[]>('/problem/list/by-difficulty', {
      query: { difficulty: selectedDiff.value },
    })
  },
  { server: false, watch: [selectedDiff] },
)

const visibleKeys = computed(() => {
  if (selectedDiff.value) {
    return sortedKeys.value.includes(selectedDiff.value) ? [selectedDiff.value] : []
  }
  return sortedKeys.value
})

function previewFor(k: string): ProblemItem[] {
  return data.value?.[k]?.items || []
}

function totalFor(k: string): number {
  return data.value?.[k]?.total || 0
}

useHead({ title: '题目库 - 洛谷档案馆' })

</script>

<template>
  <div>
    <!-- 页面头：裸排 + border-b -->
    <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-muted-foreground">题解开放状态</p>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">题目库</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">上次更新 · {{ relTime }}</span>
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5"
          :class="saveButtonCls"
          :disabled="saveState === 'pending'"
          @click="saveProblemList"
        >
          <RefreshCw class="size-3.5" />
          {{ saveState === 'idle' ? '立即更新' : saveMessage }}
        </Button>
        <CaptchaChallenge
          v-if="showCaptcha"
          ref="captchaRef"
          id-suffix="problem-list-save"
          @verified="onCaptchaVerified"
        />
      </div>
    </header>

    <p v-if="selectedDiff" class="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      当前难度
      <span class="lg-name font-semibold" :data-color="diffColor[selectedDiff] || 'Gray'">{{ selectedDiff }}</span>
      ·
      <NuxtLink to="/problem/list" class="font-medium text-foreground transition-colors hover:text-primary">← 返回所有难度</NuxtLink>
    </p>
    <p v-else class="mt-4 text-sm text-muted-foreground">
      允许提交题解的题目，按洛谷难度分档，每档仅显示前 {{ PREVIEW_LIMIT }} 道，点「查看全部」看完整列表。
      <a
        href="https://www.luogu.com.cn/problem/list"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-1 inline-flex items-center gap-0.5 font-medium text-foreground transition-colors hover:text-primary"
      >查看洛谷原文<ExternalLink class="size-3" /></a>
    </p>

    <!-- 首屏骨架：难度段同构 -->
    <div v-if="listPending && !data" class="mt-5 space-y-7">
      <div v-for="i in 4" :key="i">
        <div class="flex items-center gap-2.5">
          <Skeleton class="h-5 w-20" />
          <Skeleton class="h-3.5 w-10" />
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <Skeleton v-for="j in 6" :key="j" class="h-9 rounded-md" />
        </div>
      </div>
    </div>

    <!-- 单档全量视图 -->
    <section v-else-if="selectedDiff" class="mt-5">
      <div class="flex items-center gap-2.5">
        <h2 class="text-lg font-semibold tracking-tight">
          <span class="lg-name" :data-color="diffColor[selectedDiff] || 'Gray'">{{ selectedDiff }}</span>
        </h2>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {{ fullList?.length || 0 }}
        </span>
      </div>

      <div v-if="fullPending" class="mt-3 grid gap-2 sm:grid-cols-2">
        <Skeleton v-for="i in 10" :key="i" class="h-9 rounded-md" />
      </div>
      <ul v-else-if="fullList && fullList.length" class="mt-3 grid list-none gap-2 sm:grid-cols-2">
        <li v-for="p in fullList" :key="p.pid">
          <a
            :href="`https://www.luogu.com.cn/problem/${p.pid}`"
            target="_blank"
            rel="noopener"
            class="flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <span class="lg-name shrink-0 font-mono text-[13px] font-semibold" :data-color="diffColor[selectedDiff] || 'Gray'">{{ p.pid }}</span>
            <span class="min-w-0 truncate">{{ p.title }}</span>
          </a>
        </li>
      </ul>
      <p v-else class="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        该档暂无题目
      </p>
    </section>

    <!-- 总览：所有难度的预览 -->
    <section v-for="k in visibleKeys" v-else :key="k" class="mt-7">
      <div class="flex flex-wrap items-center gap-2.5">
        <h2 class="text-lg font-semibold tracking-tight">
          <span class="lg-name" :data-color="diffColor[k] || 'Gray'">{{ k }}</span>
        </h2>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {{ totalFor(k) }}
        </span>
        <NuxtLink
          v-if="totalFor(k) > PREVIEW_LIMIT"
          :to="{ path: '/problem/list', query: { difficulty: k } }"
          class="ml-auto text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          查看全部 →
        </NuxtLink>
      </div>

      <ul class="mt-3 grid list-none gap-2 sm:grid-cols-2">
        <li v-for="p in previewFor(k)" :key="p.pid">
          <a
            :href="`https://www.luogu.com.cn/problem/${p.pid}`"
            target="_blank"
            rel="noopener"
            class="flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <span class="lg-name shrink-0 font-mono text-[13px] font-semibold" :data-color="diffColor[k] || 'Gray'">{{ p.pid }}</span>
            <span class="min-w-0 truncate">{{ p.title }}</span>
          </a>
        </li>
      </ul>

      <p
        v-if="totalFor(k) > PREVIEW_LIMIT"
        class="mt-2 text-[13px] text-muted-foreground"
      >
        仅显示前 {{ PREVIEW_LIMIT }} 道（共 {{ totalFor(k) }} 道），
        <NuxtLink :to="{ path: '/problem/list', query: { difficulty: k } }" class="font-medium text-foreground transition-colors hover:text-primary">
          查看该档全部题目 →
        </NuxtLink>
      </p>
    </section>
  </div>
</template>
