<script setup lang="ts">
withDefaults(defineProps<{
  appearance?: 'filled' | 'ghost' | 'outline' | 'tint'
  color?: 'brand' | 'danger' | 'important' | 'informative' | 'severe' | 'subtle' | 'success' | 'warning'
  size?: 'tiny' | 'extra-small' | 'small' | 'medium' | 'large'
  shape?: 'rounded' | 'circular' | 'square'
}>(), { appearance: 'tint', size: 'small', shape: 'rounded' })
</script>

<template>
  <fluent-badge
    class="f-badge"
    :appearance="appearance"
    :color="color"
    :size="size"
    :shape="shape"
  >
    <slot />
  </fluent-badge>
</template>
