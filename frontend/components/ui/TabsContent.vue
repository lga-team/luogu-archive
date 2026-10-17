<script setup lang="ts">
import { TabsContent } from 'reka-ui'
defineProps<{ value: string }>()
</script>
<template><TabsContent :value="value" class="archive-tabs-content"><slot /></TabsContent></template>
