<script setup lang="ts">
import { RadioGroupItem, RadioGroupIndicator } from 'reka-ui'
import { Circle } from 'lucide-vue-next'
defineProps<{ value: string; disabled?: boolean }>()
</script>
<template><RadioGroupItem :value="value" :disabled="disabled" class="archive-radio-item"><RadioGroupIndicator class="archive-radio-indicator"><Circle :size="9" fill="currentColor" aria-hidden="true" /></RadioGroupIndicator></RadioGroupItem></template>
