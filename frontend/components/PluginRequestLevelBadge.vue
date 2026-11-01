<script setup lang="ts">
const props = defineProps<{ level: number; compact?: boolean }>()
const { requestLevel } = usePluginLabels()
const meta = computed(() => requestLevel(props.level))
</script>

<template>
  <span
    class="request-level"
    :class="[meta.className, { compact }]"
    :title="`请求等级 ${level}：${meta.label}`"
    :aria-label="`请求等级 ${level}：${meta.label}`"
  >
    <span class="label">请求等级</span>
    <span class="number" aria-hidden="true">{{ level }}</span>
  </span>
</template>

<style scoped>
.request-level {
  --level-color: #2da44e;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 26px;
  padding: 1px 4px 1px 9px;
  border: 1px solid color-mix(in srgb, var(--level-color) 55%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--level-color) 10%, var(--colorNeutralBackground1));
  color: var(--level-color);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.number { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--level-color); color: #fff; line-height: 1; font-size: 11px; }
.level-1 { --level-color: #6c8f1c; }
.level-2 { --level-color: #a87900; }
.level-3 { --level-color: #c0392b; }
.compact { min-height: 22px; gap: 5px; padding-left: 7px; font-size: 11px; }
.compact .number { width: 17px; height: 17px; font-size: 10px; }
:global(html.dark .level-0) { --level-color: #6ccb5f; }
:global(html.dark .level-1) { --level-color: #b5cf62; }
:global(html.dark .level-2) { --level-color: #e3b341; }
:global(html.dark .level-3) { --level-color: #ff7b72; }
</style>
