<script setup lang="ts">
export interface RadioOption {
  value: string
  label: string
  disabled?: boolean
  description?: string
}

withDefaults(defineProps<{
  modelValue: string
  options: RadioOption[]
  orientation?: 'horizontal' | 'vertical'
  ariaLabel?: string
}>(), { orientation: 'vertical' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function select(value: string) {
  emit('update:modelValue', value)
}

function onChange(event: Event) {
  const value = String((event.target as any)?.value || '')
  if (value) emit('update:modelValue', value)
}
</script>

<template>
  <fluent-radio-group
    class="f-radio-group"
    :class="'f-radio-group--' + orientation"
    :value="modelValue"
    :aria-label="ariaLabel"
    @change="onChange"
  >
    <label v-for="option in options" :key="option.value" class="f-radio" @click="select(option.value)">
      <fluent-radio
        :value="option.value"
        :checked="modelValue === option.value || undefined"
        :disabled="option.disabled || undefined"
      />
      <span class="f-radio__text">
        <span class="f-radio__label">{{ option.label }}</span>
        <span v-if="option.description" class="f-radio__description">{{ option.description }}</span>
      </span>
    </label>
  </fluent-radio-group>
</template>

<style scoped>
.f-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
.f-radio-group--vertical { flex-direction: column; align-items: stretch; }
.f-radio {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--borderRadiusMedium);
  cursor: pointer;
  font-size: 13px;
  transition: background var(--app-transition);
}
.f-radio:hover { background: var(--colorNeutralBackground1Hover); }
.f-radio__text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.f-radio__label { color: var(--colorNeutralForeground1); }
.f-radio__description { color: var(--colorNeutralForeground3); font-size: 11px; }
</style>
