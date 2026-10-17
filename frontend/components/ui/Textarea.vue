<script setup lang="ts">
const model = defineModel<string>()
</script>
<template><textarea class="archive-textarea" :value="model" @input="model = ($event.target as HTMLTextAreaElement).value" /></template>
