<script setup lang="ts">
import {
  SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectPortal, SelectContent,
  SelectViewport, SelectItem, SelectItemText, SelectItemIndicator,
  SelectScrollUpButton, SelectScrollDownButton,
} from 'reka-ui'
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next'

// 按 shadcn-vue 的 Select 组合结构适配，交互由 Reka UI 提供（MIT）。
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly { value: string; label: string; disabled?: boolean }[]
  disabled?: boolean
  placeholder?: string
  name?: string
}>(), { disabled: false, placeholder: '请选择' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()
// 空字符串仍是对外的有效选项值，不使用会与业务值冲突的特殊占位项。
const internalValue = computed(() => 'option:' + props.modelValue)
const selectedText = computed(() => props.options.find(option => option.value === props.modelValue)?.label ?? props.placeholder)
function updateValue(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('option:')) return
  const next = value.slice('option:'.length)
  if (next === props.modelValue) return
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <SelectRoot :model-value="internalValue" :disabled="disabled" @update:model-value="updateValue">
    <SelectTrigger v-bind="$attrs" class="archive-select-trigger" :title="selectedText">
      <SelectValue class="archive-select-value" :placeholder="placeholder">{{ selectedText }}</SelectValue>
      <SelectIcon as-child><ChevronDown :size="14" class="archive-select-chevron" aria-hidden="true" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="archive-ui archive-select-content" position="popper" align="start" :side-offset="5" :collision-padding="8" :body-lock="false">
        <SelectScrollUpButton class="archive-select-scroll" aria-label="向上滚动选项"><ChevronUp :size="14" aria-hidden="true" /></SelectScrollUpButton>
        <SelectViewport class="archive-select-viewport">
          <SelectItem v-for="option in options" :key="option.value" :value="'option:' + option.value" :disabled="option.disabled" :text-value="option.label" class="archive-select-item">
            <SelectItemText class="archive-select-item-text">{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="archive-select-indicator"><Check :size="14" aria-hidden="true" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
        <SelectScrollDownButton class="archive-select-scroll" aria-label="向下滚动选项"><ChevronDown :size="14" aria-hidden="true" /></SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
  <input v-if="name" type="hidden" :name="name" :value="modelValue" :disabled="disabled">
</template>

<style src="~/assets/css/select.css" />
