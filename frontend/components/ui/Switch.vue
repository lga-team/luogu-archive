<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
const model = defineModel<boolean>({ default: false })
defineProps<{ disabled?: boolean }>()
</script>
<template><SwitchRoot v-model="model" class="archive-switch" :disabled="disabled"><SwitchThumb class="archive-switch-thumb" /></SwitchRoot></template>
