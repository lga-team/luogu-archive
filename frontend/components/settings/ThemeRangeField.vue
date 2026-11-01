<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ label: string; min?: number; max?: number; unit?: string }>(), {
  min: 0,
  max: 100,
  unit: '%',
})
const model = defineModel<number>({ required: true })
const id = useId()
</script>

<template>
  <div class="theme-field stack stack--xs">
    <span :id="id" class="field-label">{{ label }}（{{ model }}{{ unit }}）</span>
    <FSlider
      :model-value="model"
      :min="min"
      :max="max"
      :step="1"
      :aria-label="label"
      @update:model-value="model = $event"
    />
  </div>
</template>
