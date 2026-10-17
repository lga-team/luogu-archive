<script setup lang="ts">
import { useId } from 'vue'
import { Label, Slider } from '../ui'
withDefaults(defineProps<{ label: string; min?: number; max?: number; unit?: string }>(), { min: 0, max: 100, unit: '%' })
const model = defineModel<number>({ required: true })
const id = useId()
</script>
<template><div class="theme-field"><Label :id="id">{{ label }}（{{ model }}{{ unit }}）</Label><Slider :aria-labelledby="id" :model-value="[model]" :min="min" :max="max" :step="1" @update:model-value="model = $event[0] ?? min" /></div></template>
