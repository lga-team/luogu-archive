<script setup lang="ts">
import { Primitive } from 'reka-ui'
// 按 shadcn-vue 的 Primitive 结构适配，沿用本站样式，不注入全局重置。
withDefaults(defineProps<{
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
  asChild?: boolean
}>(), { variant: 'default', size: 'default', asChild: false })
</script>
<template>
  <Primitive :as-child="asChild" as="button" :type="asChild ? undefined : 'button'"
    :class="['archive-button', 'archive-button-' + size, variant === 'default' ? 'archive-button-primary' : 'archive-button-' + variant]"><slot /></Primitive>
</template>
