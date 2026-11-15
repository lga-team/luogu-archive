<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { SolutionDiffRow } from '~/types/solutionFix'
import { solutionChangeStarts, solutionDiffEntries } from '~/utils/solutionDiffView'

const props = withDefaults(defineProps<{
  rows: readonly SolutionDiffRow[]
  onlyChanges?: boolean
  leftLabel?: string
  rightLabel?: string
  maxHeight?: string
}>(), {
  onlyChanges: false,
  leftLabel: '原文',
  rightLabel: '修正后',
  maxHeight: '620px',
})
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

watch(() => props.rows, () => {
  page.value = 1
  activeChange.value = 0
  expanded.value = new Set()
}, { immediate: true })
watch([starts, activeChange], () => {
  emit('navigation', { current: starts.value.length ? activeChange.value + 1 : 0, total: starts.value.length })
}, { immediate: true })
watch(() => props.onlyChanges, () => { page.value = 1; void locateChange() })

async function locateChange() {
  const index = starts.value[activeChange.value]
  if (index === undefined) return
  const position = entries.value.findIndex(entry => entry.kind === 'row' && entry.index === index)
  if (position < 0) return
  page.value = Math.floor(position / perPage) + 1
  await nextTick()
  const container = scroller.value
  const target = container?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
  if (!container || !target) return
  const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  container.scrollTo({ top: Math.max(0, top - 8), behavior: reduce ? 'auto' : 'smooth' })
}
function navigate(direction: number) {
  if (!starts.value.length) return
  activeChange.value = (activeChange.value + direction + starts.value.length) % starts.value.length
  void locateChange()
}
function expand(start: number) {
  expanded.value = new Set([...expanded.value, start])
}
function label(row: SolutionDiffRow) {
  const kind = { same: '未修改', add: '新增', remove: '删除', change: '修改' }[row.kind]
  return `${kind}，${props.leftLabel}${row.leftNo === null ? '无对应行' : `第 ${row.leftNo} 行`}，${props.rightLabel}${row.rightNo === null ? '无对应行' : `第 ${row.rightNo} 行`}`
}
defineExpose({ navigate })
</script>

<template>
  <div class="solution-diff" :style="{ '--sd-max-height': maxHeight }">
    <div class="solution-diff-head"><span>{{ leftLabel }}</span><span>{{ rightLabel }}</span></div>
    <div ref="scroller" class="solution-diff-scroll" tabindex="0" aria-label="逐行差异对比">
      <template v-for="entry in visibleEntries" :key="entry.kind === 'row' ? 'r' + entry.index : 'f' + entry.start">
        <button v-if="entry.kind === 'fold'" type="button" class="solution-diff-fold" @click="expand(entry.start)">
          <ChevronRight :size="15" aria-hidden="true" />已折叠 {{ entry.count }} 行未修改内容
        </button>
        <div
          v-else
          class="solution-diff-row"
          :class="entry.row.kind"
          :data-row-index="entry.index"
          role="group"
          :aria-label="label(entry.row)"
        >
          <div class="solution-diff-cell solution-diff-old" :class="{ 'solution-diff-absent': entry.row.leftNo === null }">
            <span class="solution-line-no" aria-hidden="true">{{ entry.row.leftNo ?? '' }}</span>
            <code><template v-if="entry.row.leftSegments"><span
              v-for="(segment, part) in entry.row.leftSegments"
              :key="part"
              :class="{ 'solution-char-removed': segment.changed }"
            >{{ segment.text }}</span></template><template v-else>{{ entry.row.left }}</template><small v-if="entry.row.leftNoNewline">无行尾换行</small></code>
          </div>
          <div class="solution-diff-cell solution-diff-new" :class="{ 'solution-diff-absent': entry.row.rightNo === null }">
            <span class="solution-line-no" aria-hidden="true">{{ entry.row.rightNo ?? '' }}</span>
            <code><template v-if="entry.row.rightSegments"><span
              v-for="(segment, part) in entry.row.rightSegments"
              :key="part"
              :class="{ 'solution-char-added': segment.changed }"
            >{{ segment.text }}</span></template><template v-else>{{ entry.row.right }}</template><small v-if="entry.row.rightNoNewline">无行尾换行</small></code>
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
.solution-diff-head {
  color: var(--colorNeutralForeground3); font-size: 12px; font-weight: 600;
  background: var(--colorNeutralBackground2);
  border-top: 1px solid var(--colorNeutralStroke2); border-bottom: 1px solid var(--colorNeutralStroke2);
}
.solution-diff-head > span { padding: 9px 16px; }
.solution-diff-head > span + span { border-left: 1px solid var(--colorNeutralStroke2); }
.solution-diff-scroll {
  min-height: 320px; max-height: var(--sd-max-height);
  overflow: auto; scrollbar-width: thin;
  font-family: var(--fontFamilyMonospace); font-size: 12.5px; line-height: 1.85;
}
.solution-diff-row { min-height: 1.85em; }
.solution-diff-cell {
  display: grid; grid-template-columns: 46px minmax(0, 1fr); min-width: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--colorNeutralStroke2) 55%, transparent);
}
.solution-diff-cell + .solution-diff-cell { border-left: 1px solid var(--colorNeutralStroke2); }
.solution-diff-cell.solution-diff-absent { background: var(--colorNeutralBackground3); }
.solution-line-no {
  padding: 3px 10px; color: var(--colorNeutralForeground4);
  text-align: right; user-select: none; font-variant-numeric: tabular-nums;
  background: var(--colorNeutralBackground2);
}
.solution-diff-cell code {
  display: block; padding: 3px 12px; white-space: pre-wrap; overflow-wrap: anywhere;
  font: inherit; color: var(--colorNeutralForeground1);
}
.solution-diff-cell small { display: block; color: var(--colorNeutralForeground3); font: 11px/1.6 sans-serif; }
.solution-diff-row.add .solution-diff-new,
.solution-diff-row.change .solution-diff-new { background: color-mix(in srgb, var(--colorPaletteGreenBackground1, #dff6dd) 55%, transparent); }
.solution-diff-row.remove .solution-diff-old,
.solution-diff-row.change .solution-diff-old { background: color-mix(in srgb, var(--colorPaletteRedBackground1, #fde7e9) 55%, transparent); }
.solution-char-removed {
  background: color-mix(in srgb, var(--colorPaletteRedForeground1, #b10e1c) 24%, transparent);
  text-decoration: line-through;
}
.solution-char-added {
  background: color-mix(in srgb, var(--colorPaletteGreenForeground1, #0e700e) 24%, transparent);
  text-decoration: underline; text-underline-offset: 3px;
}
.solution-diff-fold {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px;
  padding: 8px 16px; border: 0; border-top: 1px solid var(--colorNeutralStroke2); border-bottom: 1px solid var(--colorNeutralStroke2);
  background: var(--colorNeutralBackground2); color: var(--colorNeutralForeground3);
  font: inherit; font-size: 12px; text-align: left; cursor: pointer;
}
.solution-diff-fold:hover { color: var(--colorBrandForeground1); }
.solution-diff-empty { margin: 0; padding: 20px; color: var(--colorNeutralForeground3); font-size: 13px; }
.solution-diff-scroll:focus-visible, .solution-diff-fold:focus-visible { outline: 2px solid var(--colorBrandStroke1); outline-offset: -2px; }
@media (max-width: 640px) {
  .solution-diff-head { display: none; }
  .solution-diff-row { grid-template-columns: minmax(0, 1fr); }
  .solution-diff-cell + .solution-diff-cell { border-left: 0; }
  .solution-diff-cell.solution-diff-absent, .solution-diff-row.same .solution-diff-new { display: none; }
  .solution-diff-row:not(.same) .solution-diff-cell::before {
    grid-column: 1 / -1; padding: 5px 12px 0;
    color: var(--colorNeutralForeground3); font: 11px/1.5 sans-serif;
  }
  .solution-diff-row:not(.same) .solution-diff-old::before { content: '− 原文'; }
  .solution-diff-row:not(.same) .solution-diff-new::before { content: '+ 修正后'; }
}
</style>
