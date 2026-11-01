<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <PageHeader :title="title" :description="subtitle">
    <template v-if="$slots.extra" #actions><slot name="extra" /></template>
  </PageHeader>
</template>
