<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  eyebrow?: string
  compact?: boolean
}>(), { compact: false })
</script>

<template>
  <header class="page-header" :class="{ 'page-header--compact': compact }">
    <div class="page-header__main">
      <span v-if="eyebrow" class="page-header__eyebrow"><slot name="eyebrow">{{ eyebrow }}</slot></span>
      <h1 class="page-header__title">
        <slot name="icon" />
        {{ title }}
        <slot name="title-extra" />
      </h1>
      <p v-if="description || $slots.description" class="page-header__description">
        <slot name="description">{{ description }}</slot>
      </p>
      <div v-if="$slots.meta" class="page-header__meta"><slot name="meta" /></div>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header--compact .page-header__title { font-size: var(--fontSizeBase500); }
</style>
