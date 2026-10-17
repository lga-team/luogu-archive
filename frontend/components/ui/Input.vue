<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>
<template><input class="archive-input" :value="model" @input="model = ($event.target as HTMLInputElement).value"></template>
