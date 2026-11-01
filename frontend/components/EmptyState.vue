<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
withDefaults(defineProps<{ title?: string; description?: string; icon?: any }>(), {
  title: '暂无内容',
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <component :is="icon || Inbox" :size="24" aria-hidden="true" />
    </div>
    <div class="empty-state__title">{{ title }}</div>
    <p v-if="description || $slots.default" class="empty-state__body">
      <slot>{{ description }}</slot>
    </p>
    <div v-if="$slots.actions" style="margin-top: 6px"><slot name="actions" /></div>
  </div>
</template>
