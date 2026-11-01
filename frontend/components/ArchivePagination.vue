<script setup lang="ts">
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'

const props = defineProps<{ page: number; totalPages: number; pending?: boolean }>()
const emit = defineEmits<{ page: [page: number] }>()

const total = computed(() => Math.max(1, props.totalPages))
const current = computed(() => Math.min(total.value, Math.max(1, props.page)))
const pages = computed(() => {
  const count = Math.min(10, total.value)
  const start = Math.max(1, Math.min(current.value - 5, total.value - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
})
const actions = computed(() => [
  { target: 1, label: '首页', icon: ChevronsLeft, disabled: current.value === 1 },
  { target: current.value - 1, label: '上一页', icon: ChevronLeft, disabled: current.value === 1 },
  { target: current.value + 1, label: '下一页', icon: ChevronRight, disabled: current.value === total.value },
  { target: total.value, label: '末页', icon: ChevronsRight, disabled: current.value === total.value },
])
function go(page: number) {
  if (props.pending) return
  emit('page', page)
}
</script>

<template>
  <nav class="pagination" aria-label="分页" :aria-busy="pending">
    <span class="sr-only" aria-live="polite">共 {{ total }} 页，当前第 {{ current }} 页</span>
    <button
      v-for="action in actions.slice(0, 2)"
      :key="action.label"
      type="button"
      class="pagination__page"
      :aria-label="action.label"
      :title="action.label"
      :disabled="pending || action.disabled"
      @click="go(action.target)"
    >
      <component :is="action.icon" :size="15" aria-hidden="true" />
    </button>
    <button
      v-for="number in pages"
      :key="number"
      type="button"
      class="pagination__page"
      :class="{ 'is-active': number === current }"
      :aria-label="'第 ' + number + ' 页'"
      :aria-current="number === current ? 'page' : undefined"
      :disabled="pending"
      @click="number !== current && go(number)"
    >{{ number }}</button>
    <button
      v-for="action in actions.slice(2)"
      :key="action.label"
      type="button"
      class="pagination__page"
      :aria-label="action.label"
      :title="action.label"
      :disabled="pending || action.disabled"
      @click="go(action.target)"
    >
      <component :is="action.icon" :size="15" aria-hidden="true" />
    </button>
    <span class="pagination__total muted">共 {{ total }} 页</span>
  </nav>
</template>

<style scoped>
.pagination__total { margin-left: 6px; font-size: 12px; white-space: nowrap; }
@media (max-width: 680px) {
  .pagination { gap: 2px; }
  .pagination__page { min-width: 30px; height: 30px; padding: 0 5px; }
  .pagination__total { display: none; }
}
</style>
