<script setup lang="ts">
import { Slider } from './ui'

defineProps<{ label: string }>()
const level = defineModel<number>({ required: true })
const { requestLevels } = usePluginLabels()
const maxLevel = requestLevels.length - 1
const pointerId = ref<number | null>(null)
const draft = ref<number | null>(null)
const sliderValue = computed({
  get: () => [draft.value ?? level.value],
  set: ([value]: number[]) => {
    if (pointerId.value !== null && value !== undefined) draft.value = value
  },
})

function startDrag(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || pointerId.value !== null) return
  pointerId.value = event.pointerId
}

function endDrag(event: PointerEvent, commit: boolean) {
  if (pointerId.value !== event.pointerId) return
  if (commit && draft.value !== null) level.value = Math.round(draft.value)
  pointerId.value = null
  draft.value = null
}

function onSliderKey(event: KeyboardEvent) {
  let next: number
  switch (event.key) {
    case 'Home':
    case 'PageDown': next = 0; break
    case 'End':
    case 'PageUp': next = maxLevel; break
    case 'ArrowUp': next = level.value + 1; break
    case 'ArrowDown': next = level.value - 1; break
    case 'ArrowLeft':
    case 'ArrowRight': {
      const rtl = event.target instanceof HTMLElement && event.target.closest('[dir]')?.getAttribute('dir') === 'rtl'
      next = level.value + ((event.key === 'ArrowRight') !== rtl ? 1 : -1)
      break
    }
    default: return
  }
  event.preventDefault()
  event.stopPropagation()
  if (pointerId.value === null) level.value = Math.max(0, Math.min(maxLevel, next))
}
</script>

<template>
  <div
    class="archive-ui level-scale"
    :data-dragging="pointerId !== null ? '' : undefined"
    :style="{ '--level-progress': (draft ?? level) / maxLevel }"
  >
    <Slider
      v-model="sliderValue"
      :min="0"
      :max="maxLevel"
      :step="0.001"
      :aria-label="label"
      @pointerdown.capture="startDrag"
      @pointerup.capture="endDrag($event, true)"
      @pointercancel.capture="endDrag($event, false)"
      @lostpointercapture="endDrag($event, false)"
      @keydown.capture="onSliderKey"
    />
    <div class="level-ticks" aria-hidden="true">
      <span v-for="(_, index) in requestLevels" :key="index">{{ index }}</span>
    </div>
  </div>
</template>

<style scoped>
.level-scale { width: 100%; min-width: 0; --level-thumb-size: 16px; --level-snap: 150ms cubic-bezier(.2, .75, .25, 1); }
.level-scale :deep(.archive-slider-track) { height: 5px; background: var(--border); }
.level-scale :deep(.archive-slider-range) { background: transparent; }
.level-scale :deep(.archive-slider-range::before) {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  /* The contained thumb travels the track width minus its own width. */
  inset-inline-end: calc(var(--level-progress) * var(--level-thumb-size));
  background: var(--link);
}
.level-scale :deep(.archive-slider-thumb) {
  width: var(--level-thumb-size);
  height: var(--level-thumb-size);
  border-width: 1px;
  background: var(--surface);
  box-shadow: 0 1px 2px #0002;
}
.level-scale :deep(.archive-slider-thumb:hover) { box-shadow: 0 0 0 4px color-mix(in srgb, var(--link) 16%, transparent); }
.level-ticks { display: flex; justify-content: space-between; padding-inline: 4px; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
.level-ticks span { display: grid; justify-items: center; gap: 3px; min-width: 8px; }
.level-ticks span::before { content: ''; width: 1px; height: 4px; background: var(--border); }
@media (prefers-reduced-motion: no-preference) {
  .level-scale:not([data-dragging]) :deep(.archive-slider-range),
  .level-scale:not([data-dragging]) :deep(.archive-slider-thumb) { transition: left var(--level-snap), right var(--level-snap), box-shadow 120ms ease-out; }
  .level-scale:not([data-dragging]) :deep(.archive-slider-range::before) { transition: inset-inline-end var(--level-snap); }
}
</style>
