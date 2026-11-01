<script setup lang="ts">
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
  label?: string
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const el = ref<any>(null)

function onChange(event: Event) {
  const target = event.target as any
  emit('update:modelValue', Boolean(target?.checked ?? !props.modelValue))
}

function toggleFromLabel() {
  if (props.disabled) return
  const next = !props.modelValue
  if (el.value) el.value.checked = next
  emit('update:modelValue', next)
}
</script>

<template>
  <span class="f-checkbox">
    <fluent-checkbox
      ref="el"
      :checked="modelValue || undefined"
      :disabled="disabled || undefined"
      :aria-label="ariaLabel || label"
      @change="onChange"
    >
      <Check v-if="modelValue" slot="checked-indicator" :size="12" :stroke-width="3" aria-hidden="true" />
    </fluent-checkbox>
    <span
      v-if="label || $slots.default"
      class="f-checkbox__label"
      :class="{ 'is-disabled': disabled }"
      @click="toggleFromLabel"
    >
      <slot>{{ label }}</slot>
    </span>
  </span>
</template>

<style scoped>
.f-checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
.f-checkbox__label { color: var(--colorNeutralForeground2); cursor: pointer; user-select: none; }
.f-checkbox__label.is-disabled { cursor: not-allowed; color: var(--colorNeutralForegroundDisabled); }
</style>
