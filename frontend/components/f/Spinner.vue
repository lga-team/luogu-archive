<script setup lang="ts">
withDefaults(defineProps<{ size?: 'tiny' | 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large' | 'huge'; label?: string }>(), {
  size: 'medium',
  label: '加载中',
})
</script>

<template>
  <span class="f-spinner" role="status" :aria-label="label">
    <fluent-spinner :size="size" />
  </span>
</template>

<style scoped>
.f-spinner { display: inline-flex; align-items: center; justify-content: center; }
</style>
