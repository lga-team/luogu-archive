<script setup lang="ts">
/** 客户端路由切换（非 SSR 首屏）时占位，避免白屏/旧页面残留。 */
const route = useRoute()
const kind = computed(() => {
  const path = route.path
  if (/^\/(?:solution|judgement|me|settings|takedown|announcement)/.test(path) || /^\/[^/]+\/[^/]+/.test(path)) return 'detail'
  if (/^\/(?:plugin|feed|discuss|problem|contest|admin)/.test(path)) return 'list'
  return 'cards'
})
</script>

<template>
  <div class="page page--medium route-skeleton" role="status" aria-live="polite" aria-label="正在加载页面">
    <div class="route-skeleton__header" aria-hidden="true">
      <span class="skeleton skeleton--line" style="width: 88px; height: 10px" />
      <span class="skeleton skeleton--title" />
      <span class="skeleton skeleton--line" style="width: 62%" />
      <span class="skeleton skeleton--line" style="width: 44%" />
      <div class="route-skeleton__actions">
        <span class="skeleton" style="width: 90px; height: 32px; border-radius: 6px" />
        <span class="skeleton" style="width: 108px; height: 32px; border-radius: 6px" />
      </div>
    </div>
    <div class="route-skeleton__tabs" aria-hidden="true">
      <span v-for="i in 3" :key="i" class="skeleton" style="width: 76px; height: 30px; border-radius: 6px" />
    </div>
    <LoadingPanel :variant="kind" :rows="5" title="正在加载页面" />
    <div class="route-skeleton__cards" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="route-skeleton__card">
        <span class="skeleton skeleton--line" style="width: 48%" />
        <span class="skeleton skeleton--line" style="width: 88%" />
        <span class="skeleton skeleton--line" style="width: 70%" />
      </div>
    </div>
    <span class="sr-only">正在加载页面，请稍候…</span>
  </div>
</template>

<style scoped>
.route-skeleton { display: flex; flex-direction: column; gap: 16px; min-height: 60vh; }
.route-skeleton__header { display: flex; flex-direction: column; gap: 10px; padding: 6px 0 4px; }
.route-skeleton__actions { display: flex; gap: 8px; margin-top: 6px; }
.route-skeleton__tabs { display: flex; gap: 8px; }
.route-skeleton__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.route-skeleton__card {
  display: flex; flex-direction: column; gap: 10px; padding: 18px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge);
  background: var(--colorNeutralBackground1);
}
@media (max-width: 680px) {
  .route-skeleton__cards { grid-template-columns: minmax(0, 1fr); }
}
</style>
