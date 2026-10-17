<script setup lang="ts">
import { useId } from 'vue'
import { Label, RadioGroup, RadioGroupItem } from '../ui'
defineProps<{ label: string; options: [string, string][] }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>
<template><div class="theme-field"><Label :id="id">{{ label }}</Label><RadioGroup v-model="model" :aria-labelledby="id" class="theme-choices"><Label v-for="[key, name] in options" :key="key" class="theme-choice" :for="id + '-' + key"><RadioGroupItem :id="id + '-' + key" :value="key" />{{ name }}</Label></RadioGroup></div></template>
