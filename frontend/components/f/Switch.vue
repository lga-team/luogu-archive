<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
  label?: string
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
function onChange(event: Event) {
  emit('update:modelValue', Boolean((event.target as any)?.checked))
}
</script>

<template>
  <label class="f-switch">
    <fluent-switch
      :checked="modelValue || undefined"
      :disabled="disabled || undefined"
      :aria-label="ariaLabel || label"
      @change="onChange"
    />
    <span v-if="label || $slots.default" class="f-switch__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<style scoped>
.f-switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; }
.f-switch__label { color: var(--colorNeutralForeground2); }
</style>
