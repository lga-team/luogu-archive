<script setup lang="ts">
import type { Component } from 'vue'

export interface TabItem {
  id: string
  label: string
  icon?: Component
}

withDefaults(defineProps<{
  modelValue: string
  tabs: TabItem[]
  ariaLabel?: string
  size?: 'small' | 'medium' | 'large'
}>(), { size: 'medium' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onChange(event: Event) {
  const value = String((event.target as any)?.activeid || '')
  if (value) emit('update:modelValue', value)
}
</script>

<template>
  <fluent-tablist
    class="f-tablist"
    :activeid="modelValue"
    :size="size"
    :aria-label="ariaLabel"
    @change="onChange"
  >
    <fluent-tab v-for="tab in tabs" :id="tab.id" :key="tab.id">
      <span class="f-tablist__tab">
        <component :is="tab.icon" v-if="tab.icon" :size="16" aria-hidden="true" />
        {{ tab.label }}
      </span>
    </fluent-tab>
  </fluent-tablist>
</template>

<style scoped>
.f-tablist {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.f-tablist::-webkit-scrollbar { display: none; width: 0; height: 0; }
.f-tablist__tab { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
</style>
