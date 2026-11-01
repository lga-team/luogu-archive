<script setup lang="ts">
withDefaults(defineProps<{
  name?: string
  initials?: string
  size?: number
  color?: 'neutral' | 'brand' | 'colorful'
  shape?: 'circular' | 'square'
}>(), { size: 32, color: 'colorful', shape: 'circular' })
</script>

<template>
  <fluent-avatar
    class="f-avatar"
    :name="name"
    :initials="initials"
    :size="size"
    :color="color"
    :shape="shape"
    aria-hidden="true"
  />
</template>

<style scoped>
.f-avatar { flex-shrink: 0; }
</style>
