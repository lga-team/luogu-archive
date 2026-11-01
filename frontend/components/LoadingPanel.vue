<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  text?: string
  compact?: boolean
  variant?: 'panel' | 'list' | 'cards' | 'detail'
  rows?: number
}>(), {
  title: '正在加载',
  compact: false,
  variant: 'panel',
  rows: 4,
})
</script>

<template>
  <div
    class="loading-panel skeleton-panel"
    :class="['skeleton-panel--' + variant, { 'is-compact': compact }]"
    role="status"
    aria-live="polite"
    :aria-label="title"
  >
    <span class="sr-only">{{ title }}{{ text ? '，' + text : '' }}</span>

    <div v-if="variant === 'list'" class="skeleton-list" aria-hidden="true">
      <div v-for="row in rows" :key="row" class="skeleton-row">
        <span class="skeleton skeleton--avatar" />
        <div class="skeleton-lines">
          <span class="skeleton skeleton--line" style="width: 72%" />
          <span class="skeleton skeleton--line skeleton--line-short" style="width: 46%" />
        </div>
        <span class="skeleton skeleton--tag" />
      </div>
    </div>

    <div v-else-if="variant === 'cards'" class="skeleton-cards" aria-hidden="true">
      <div v-for="row in Math.min(rows, 4)" :key="row" class="skeleton-card">
        <span class="skeleton skeleton--icon" />
        <span class="skeleton skeleton--line" style="width: 42%" />
        <span class="skeleton skeleton--line skeleton--line-short" style="width: 64%" />
      </div>
    </div>

    <div v-else class="skeleton-detail" aria-hidden="true">
      <span class="skeleton skeleton--eyebrow" />
      <span class="skeleton skeleton--title" />
      <span class="skeleton skeleton--line" style="width: 94%" />
      <span class="skeleton skeleton--line" style="width: 82%" />
      <span v-if="!compact" class="skeleton skeleton--line" style="width: 88%" />
      <span v-if="!compact" class="skeleton skeleton--block" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-panel { align-items: stretch; text-align: left; padding: 22px; }
.skeleton-panel.is-compact { padding: 16px; }
.skeleton-list, .skeleton-cards, .skeleton-detail { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.skeleton-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.skeleton-row { display: flex; align-items: center; gap: 12px; }
.skeleton-lines { display: flex; flex-direction: column; gap: 7px; flex: 1 1 auto; min-width: 0; }
.skeleton-card {
  display: flex; flex-direction: column; gap: 10px; padding: 16px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge);
  background: var(--colorNeutralBackground1);
}
.skeleton--avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; }
.skeleton--tag { width: 54px; height: 20px; border-radius: 999px; flex-shrink: 0; }
.skeleton--eyebrow { width: 96px; height: 10px; border-radius: 4px; }
.skeleton--title { width: min(72%, 420px); height: 26px; border-radius: var(--borderRadiusMedium); margin-bottom: 4px; }
.skeleton--line { height: 12px; border-radius: 4px; }
.skeleton--line-short { height: 10px; }
.skeleton--icon { width: 34px; height: 34px; border-radius: var(--borderRadiusMedium); }
.skeleton--block { height: 120px; border-radius: var(--borderRadiusLarge); margin-top: 6px; }
.skeleton-panel--detail .skeleton--block { height: 220px; }
.skeleton-panel--list { padding: 6px 16px; }
.skeleton-panel--list .skeleton-row { padding: 12px 0; border-bottom: 1px solid var(--colorNeutralStroke2); }
.skeleton-panel--list .skeleton-row:last-child { border-bottom: 0; }
</style>
