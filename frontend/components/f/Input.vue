<script setup lang="ts">
/**
 * Fluent text-input 的 v-model 适配。
 * Fluent v3 的 value 是初始属性，这里同时同步 current-value 与 DOM 属性。
 */
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  type?: 'text' | 'email' | 'password' | 'tel' | 'url'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  size?: 'small' | 'medium' | 'large'
  appearance?: 'outline' | 'underline' | 'filled-lighter' | 'filled-darker'
  autocomplete?: string
  maxlength?: number
  name?: string
  ariaLabel?: string
}>(), { type: 'text', size: 'medium' })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  enter: [KeyboardEvent]
}>()

const el = ref<any>(null)

function readValue(event: Event): string {
  const target = event.target as any
  return String(target?.value ?? '')
}

function sync() {
  if (!el.value) return
  const next = props.modelValue == null ? '' : String(props.modelValue)
  if (String(el.value.value ?? '') !== next) el.value.value = next
}

function onInput(event: Event) {
  emit('update:modelValue', readValue(event))
}

function onChange(event: Event) {
  emit('update:modelValue', readValue(event))
  emit('change', readValue(event))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') emit('enter', event)
}

onMounted(sync)
watch(() => props.modelValue, () => nextTick(sync))
</script>

<template>
  <fluent-text-input
    ref="el"
    class="f-input"
    :value="modelValue ?? ''"
    :current-value="modelValue ?? ''"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled || undefined"
    :readonly="readonly || undefined"
    :required="required || undefined"
    :appearance="appearance"
    :control-size="size"
    :autocomplete="autocomplete"
    :maxlength="maxlength"
    :name="name"
    :aria-label="ariaLabel"
    @input="onInput"
    @change="onChange"
    @keydown="onKeydown"
  >
    <slot />
  </fluent-text-input>
</template>

<style scoped>
.f-input { width: 100%; max-width: 100%; }
</style>
