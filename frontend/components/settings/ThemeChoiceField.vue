<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; options: [string, string][] }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="theme-field stack stack--xs">
    <span :id="id" class="field-label">{{ label }}</span>
    <FRadioGroup
      :model-value="model"
      :options="options.map(([value, label]) => ({ value, label }))"
      orientation="horizontal"
      :aria-label="label"
      @update:model-value="model = $event"
    />
  </div>
</template>
