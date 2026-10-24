<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'

withDefaults(defineProps<{
  variant?: 'icon' | 'nav'
  collapsed?: boolean
}>(), {
  variant: 'icon',
  collapsed: false,
})

const colorMode = useColorMode()

// 循环顺序：浅色 → 深色 → 跟随系统 → 浅色。
const ORDER = ['light', 'dark', 'system'] as const
type Preference = typeof ORDER[number]

const LABELS: Record<Preference, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

const preference = computed<Preference>(() => {
  const value = colorMode.preference as Preference
  return ORDER.includes(value) ? value : 'system'
})

const currentLabel = computed(() => LABELS[preference.value])
const nextLabel = computed(() => LABELS[ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]])

function cycle() {
  colorMode.preference = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]
}
</script>

<template>
  <Button
    v-if="variant === 'icon'"
    variant="ghost"
    size="icon"
    :aria-label="`主题：${currentLabel}，点击切换为${nextLabel}`"
    @click="cycle"
  >
    <Sun v-show="preference === 'light'" class="size-[18px] shrink-0" />
    <Moon v-show="preference === 'dark'" class="size-[18px] shrink-0" />
    <Monitor v-show="preference === 'system'" class="size-[18px] shrink-0" />
  </Button>
  <button
    v-else
    type="button"
    class="flex items-center rounded-md px-[11px] py-2 text-sm text-muted-foreground transition-[gap,color,background-color] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)] hover:bg-accent hover:text-foreground"
    :class="collapsed ? 'gap-0' : 'gap-3'"
    :aria-label="`主题：${currentLabel}，点击切换为${nextLabel}`"
    @click="cycle"
  >
    <Sun v-show="preference === 'light'" class="size-[18px] shrink-0" />
    <Moon v-show="preference === 'dark'" class="size-[18px] shrink-0" />
    <Monitor v-show="preference === 'system'" class="size-[18px] shrink-0" />
    <span
      class="overflow-hidden text-ellipsis whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.2,0.7,0.3,1)]"
      :class="collapsed ? 'max-w-0 opacity-0' : 'max-w-[112px] opacity-100'"
    >{{ currentLabel }}</span>
  </button>
</template>
