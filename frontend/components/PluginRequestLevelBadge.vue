<script setup lang="ts">
const props = defineProps<{ level: number; compact?: boolean }>()
const { requestLevel, levelColor } = usePluginLabels()
const meta = computed(() => requestLevel(props.level))
const color = computed(() => levelColor(props.level))
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full border font-semibold"    :class="compact ? 'min-h-6 gap-1.5 py-0.5 pl-2 pr-0.5 text-xs' : 'min-h-[30px] gap-2 py-[3px] pl-2.5 pr-[3px] text-[13px]'"
    :style="{
      borderColor: `color-mix(in srgb, ${color} 45%, var(--border))`,
      background: `color-mix(in srgb, ${color} 8%, var(--background))`,
      color,
    }"
    :title="`请求等级 ${level}：${meta.label}`"
    :aria-label="`请求等级 ${level}：${meta.label}`"
  >
    <span>请求等级</span>
    <span
      class="inline-grid place-items-center rounded-full leading-none text-white"
      :class="compact ? 'h-5 w-5 text-[11px]' : 'h-6 w-6'"
      :style="{ background: color }"
      aria-hidden="true"
    >{{ level }}</span>
  </span>
</template>
