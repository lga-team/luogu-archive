<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'
defineProps<{ value: string }>()
</script>
<template><TabsTrigger :value="value" class="archive-tabs-trigger"><slot /></TabsTrigger></template>
