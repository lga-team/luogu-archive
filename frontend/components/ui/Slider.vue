<script setup lang="ts">
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'
const model = defineModel<number[]>({ default: () => [0] })
withDefaults(defineProps<{ min?: number; max?: number; step?: number; disabled?: boolean }>(), { min: 0, max: 100, step: 1 })
</script>
<template><SliderRoot v-model="model" class="archive-slider" :min="min" :max="max" :step="step" :disabled="disabled"><SliderTrack class="archive-slider-track"><SliderRange class="archive-slider-range" /></SliderTrack><SliderThumb v-for="(_, index) in model" :key="index" class="archive-slider-thumb" :aria-label="$attrs['aria-label'] as string" :aria-labelledby="$attrs['aria-labelledby'] as string" /></SliderRoot></template>
