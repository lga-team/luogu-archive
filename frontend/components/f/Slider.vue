<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel?: string
}>(), { min: 0, max: 100, step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
function onChange(event: Event) {
  const raw = Number((event.target as any)?.value ?? 0)
  const step = props.step || 1
  emit('update:modelValue', Math.round(raw / step) * step)
}
</script>

<template>
  <fluent-slider
    :data-step="step"
    class="f-slider"
    :value="modelValue"
    :min="min"
    :max="max"
    data-step-hint=""
    :disabled="disabled || undefined"
    :aria-label="ariaLabel"
    @change="onChange"
  />
</template>

<style scoped>
.f-slider { width: 100%; min-width: 120px; }
</style>
