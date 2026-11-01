<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  resize?: 'none' | 'both' | 'horizontal' | 'vertical'
  maxlength?: number
  name?: string
  ariaLabel?: string
}>(), { rows: 4, resize: 'vertical' })

const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()
const el = ref<any>(null)
const value = (event: Event) => String((event.target as any)?.value ?? '')
const minHeight = computed(() => Math.max(3, props.rows) * 22 + 10)

function sync() {
  if (!el.value) return
  const next = props.modelValue ?? ''
  if (String(el.value.value ?? '') !== next) el.value.value = next
}
function onInput(event: Event) { emit('update:modelValue', value(event)) }
function onChange(event: Event) { emit('update:modelValue', value(event)); emit('change', value(event)) }

onMounted(() => {
  nextTick(() => {
    sync()
    const control = el.value?.shadowRoot?.querySelector('textarea')
    if (control) control.rows = Math.max(3, props.rows)
  })
})
watch(() => props.modelValue, () => nextTick(sync))
</script>

<template>
  <fluent-textarea
    ref="el"
    class="f-textarea"
    :style="{ '--f-textarea-min-height': minHeight + 'px' }"
    :placeholder="placeholder"
    :disabled="disabled || undefined"
    :readonly="readonly || undefined"
    :required="required || undefined"
    :rows="rows"
    :resize="resize"
    :maxlength="maxlength"
    :name="name"
    :aria-label="ariaLabel"
    :value="modelValue ?? ''"
    @input="onInput"
    @change="onChange"
  />
</template>

<style scoped>
.f-textarea { width: 100%; max-width: 100%; display: block; box-sizing: border-box; }
.f-textarea::part(root) {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--f-textarea-min-height);
}
.f-textarea::part(control) {
  width: 100%;
  box-sizing: border-box;
  min-height: var(--f-textarea-min-height);
  height: 100%;
  resize: vertical;
}
</style>
