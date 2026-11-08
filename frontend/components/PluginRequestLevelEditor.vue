<script setup lang="ts">
import { useId } from 'vue'
import { Label, Switch } from './ui'

const props = defineProps<{ submittedLevel: number }>()
const level = defineModel<number | null>({ required: true })
const id = useId()
const overriding = computed({
  get: () => level.value != null,
  set: (enabled: boolean) => { level.value = enabled ? props.submittedLevel : null },
})
const displayLevel = computed({
  get: () => level.value ?? props.submittedLevel,
  set: (value: number) => { level.value = value },
})
</script>

<template>
  <div class="archive-ui level-editor">
    <div class="level-header">
      <div class="level-preview">
        <span>公开请求等级</span>
        <PluginRequestLevelBadge :level="displayLevel" compact />
      </div>
      <div class="level-toggle">
        <Label :for="id + '-override'">手动调整</Label>
        <Switch :id="id + '-override'" v-model="overriding" />
      </div>
    </div>
    <PluginRequestLevelSlider v-if="overriding" v-model="displayLevel" label="公开请求等级" />
  </div>
</template>

<style scoped>
.level-editor { display: grid; gap: 12px; min-width: 0; padding-block: 12px; border-block: 1px solid var(--border); }
.level-header, .level-preview, .level-toggle { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.level-header { justify-content: space-between; }
.level-preview { font-size: 14px; font-weight: 600; }
.level-toggle { color: var(--text-muted); }
</style>
