<script setup lang="ts">
import { TabsRoot } from 'reka-ui'
const model = defineModel<string>()
defineProps<{ defaultValue?: string }>()
</script>
<template><TabsRoot v-model="model" :default-value="defaultValue"><slot /></TabsRoot></template>
