<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'
const model = defineModel<string>({ default: '' })
</script>
<template><RadioGroupRoot v-model="model" class="archive-radio-group"><slot /></RadioGroupRoot></template>
