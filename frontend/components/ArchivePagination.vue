<script setup lang="ts">
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
import { Button } from './ui'
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
</script>
<template>
  <div class="archive-ui"><nav class="archive-pagination" aria-label="分页" :aria-busy="pending">
    <span class="archive-pagination-total" aria-live="polite">共 {{ total }} 页</span>
    <div class="archive-pagination-pages">
      <Button v-for="action in actions.slice(0, 2)" :key="action.label" variant="outline" size="icon" class="archive-page-button" :aria-label="action.label" :title="action.label" :disabled="pending || action.disabled" @click="emit('page', action.target)"><component :is="action.icon" :size="16" aria-hidden="true" /></Button>
      <Button v-for="number in pages" :key="number" variant="outline" size="icon" class="archive-page-button" :aria-label="'第 ' + number + ' 页'" :aria-current="number === current ? 'page' : undefined" :disabled="pending" @click="number !== current && emit('page', number)">{{ number }}</Button>
      <Button v-for="action in actions.slice(2)" :key="action.label" variant="outline" size="icon" class="archive-page-button" :aria-label="action.label" :title="action.label" :disabled="pending || action.disabled" @click="emit('page', action.target)"><component :is="action.icon" :size="16" aria-hidden="true" /></Button>
    </div>
  </nav></div>
</template>
<style src="~/assets/css/pagination.css" />
