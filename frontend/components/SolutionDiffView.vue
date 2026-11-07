<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { SolutionDiffRow } from '~/types/solutionFix'
import { solutionChangeStarts, solutionDiffEntries } from '~/utils/solutionDiffView'

const props = defineProps<{ rows: readonly SolutionDiffRow[]; onlyChanges?: boolean }>()
const emit = defineEmits<{ navigation: [value: { current: number; total: number }] }>()
const page = ref(1)
const activeChange = ref(0)
const expanded = shallowRef<ReadonlySet<number>>(new Set())
const scroller = shallowRef<HTMLElement | null>(null)
const perPage = 200
const starts = computed(() => solutionChangeStarts(props.rows))
const entries = computed(() => solutionDiffEntries(props.rows, Boolean(props.onlyChanges), expanded.value))
const totalPages = computed(() => Math.max(1, Math.ceil(entries.value.length / perPage)))
const visibleEntries = computed(() => entries.value.slice((page.value - 1) * perPage, page.value * perPage))
watch(() => props.rows, () => { page.value = 1; activeChange.value = 0; expanded.value = new Set() }, { immediate: true })
watch([starts, activeChange], () => emit('navigation', { current: starts.value.length ? activeChange.value + 1 : 0, total: starts.value.length }), { immediate: true })
watch(() => props.onlyChanges, () => { page.value = 1; void locateChange() })

async function locateChange() {
  const index = starts.value[activeChange.value]
  if (index === undefined) return
  const position = entries.value.findIndex(entry => entry.kind === 'row' && entry.index === index)
  if (position < 0) return
  page.value = Math.floor(position / perPage) + 1
  await nextTick()
  const container = scroller.value
  const target = container?.querySelector<HTMLElement>('[data-row-index="' + index + '"]')
  if (!container || !target) return
  const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({ top: Math.max(0, top - 8), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
function navigate(direction: number) {
  if (!starts.value.length) return
  activeChange.value = (activeChange.value + direction + starts.value.length) % starts.value.length
  void locateChange()
}
function expand(start: number) { expanded.value = new Set([...expanded.value, start]) }
function label(row: SolutionDiffRow) {
  const kind = { same: '未修改', add: '新增', remove: '删除', change: '修改' }[row.kind]
  return kind + '，原文' + (row.leftNo === null ? '无对应行' : '第 ' + row.leftNo + ' 行') + '，修正后' + (row.rightNo === null ? '无对应行' : '第 ' + row.rightNo + ' 行')
}
defineExpose({ navigate })
</script>

<template>
  <div class="solution-diff">
    <div class="solution-diff-head"><span>原文</span><span>修正后</span></div>
    <div ref="scroller" class="solution-diff-scroll" tabindex="0" aria-label="原文与修正结果差异">
      <template v-for="entry in visibleEntries" :key="entry.kind === 'row' ? 'r' + entry.index : 'f' + entry.start">
        <button v-if="entry.kind === 'fold'" class="solution-diff-fold" type="button" @click="expand(entry.start)">
          <ChevronRight :size="15" aria-hidden="true" />已折叠 {{ entry.count }} 行未修改内容
        </button>
        <div v-else class="solution-diff-row" :class="entry.row.kind" :data-row-index="entry.index" role="group" :aria-label="label(entry.row)">
          <div class="solution-diff-cell solution-diff-old" :class="{ 'solution-diff-absent': entry.row.leftNo === null }">
            <span class="solution-line-no" aria-hidden="true">{{ entry.row.leftNo ?? '' }}</span>
            <code><template v-if="entry.row.leftSegments"><span v-for="(segment, part) in entry.row.leftSegments" :key="part" :class="{ 'solution-char-removed': segment.changed }">{{ segment.text }}</span></template><template v-else>{{ entry.row.left }}</template><small v-if="entry.row.leftNoNewline">无行尾换行</small></code>
          </div>
          <div class="solution-diff-cell solution-diff-new" :class="{ 'solution-diff-absent': entry.row.rightNo === null }">
            <span class="solution-line-no" aria-hidden="true">{{ entry.row.rightNo ?? '' }}</span>
            <code><template v-if="entry.row.rightSegments"><span v-for="(segment, part) in entry.row.rightSegments" :key="part" :class="{ 'solution-char-added': segment.changed }">{{ segment.text }}</span></template><template v-else>{{ entry.row.right }}</template><small v-if="entry.row.rightNoNewline">无行尾换行</small></code>
          </div>
        </div>
      </template>
      <p v-if="!entries.length" class="solution-diff-empty">{{ onlyChanges && rows.length ? '没有修改内容' : '内容为空' }}</p>
    </div>
    <ArchivePagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" @page="page = $event" />
  </div>
</template>

<style scoped>
.solution-diff { min-width: 0; }
.solution-diff-head, .solution-diff-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.solution-diff-head { color: var(--text-muted); font-size: 12px; background: var(--hover); border-block: 1px solid var(--border); }
.solution-diff-head > span { padding: 10px 20px; }
.solution-diff-scroll { min-height: 420px; max-height: 650px; overflow: auto; scrollbar-width: thin; }
.solution-diff-row { min-height: 30px; font: 13px/1.8 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.solution-diff-cell { display: grid; grid-template-columns: 46px minmax(0, 1fr); border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent); min-width: 0; }
.solution-diff-cell + .solution-diff-cell, .solution-diff-head > span + span { border-left: 1px solid var(--border); }
.solution-line-no { padding: 4px 10px; color: var(--text-muted); text-align: right; user-select: none; font-variant-numeric: tabular-nums; }
.solution-diff-cell code { display: block; padding: 4px 12px; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; color: var(--text); }
.solution-diff-cell small { display: block; color: var(--text-muted); font: 11px/1.6 sans-serif; }
.solution-diff-row.add .solution-diff-new, .solution-diff-row.change .solution-diff-new { background: color-mix(in srgb, var(--lg-green) 12%, transparent); }
.solution-diff-row.remove .solution-diff-old, .solution-diff-row.change .solution-diff-old { background: color-mix(in srgb, var(--lg-red) 10%, transparent); }
.solution-char-removed { background: color-mix(in srgb, var(--lg-red) 32%, transparent); text-decoration: line-through; }
.solution-char-added { background: color-mix(in srgb, var(--lg-green) 34%, transparent); text-decoration: underline; text-underline-offset: 3px; }
.solution-diff-fold { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 38px; padding: 9px 20px; border: 0; border-block: 1px solid var(--border); background: var(--hover); color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
.solution-diff-fold:hover { color: var(--link); }
.solution-diff-empty { margin: 0; padding: 20px; color: var(--text-muted); font-size: 13px; }
.solution-diff-scroll:focus-visible, .solution-diff-fold:focus-visible { outline: 2px solid var(--link); outline-offset: -2px; }
@media (max-width: 640px) {
  .solution-diff-head { display: none; }
  .solution-diff-row { grid-template-columns: minmax(0, 1fr); }
  .solution-diff-cell + .solution-diff-cell { border-left: 0; }
  .solution-diff-cell.solution-diff-absent, .solution-diff-row.same .solution-diff-new { display: none; }
  .solution-diff-row:not(.same) .solution-diff-cell::before { grid-column: 1 / -1; padding: 5px 12px 0; color: var(--text-muted); font: 11px/1.5 sans-serif; }
  .solution-diff-row:not(.same) .solution-diff-old::before { content: '− 原文'; }
  .solution-diff-row:not(.same) .solution-diff-new::before { content: '+ 修正后'; }
}
</style>
