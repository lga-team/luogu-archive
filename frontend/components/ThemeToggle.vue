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
    <Sun v-if="preference === 'light'" class="size-[18px]" />
    <Moon v-else-if="preference === 'dark'" class="size-[18px]" />
    <Monitor v-else class="size-[18px]" />
  </Button>
  <button
    v-else
    type="button"
    class="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    :class="collapsed ? 'justify-center px-0' : ''"
    :aria-label="`主题：${currentLabel}，点击切换为${nextLabel}`"
    @click="cycle"
  >
    <Sun v-if="preference === 'light'" class="size-[18px] shrink-0" />
    <Moon v-else-if="preference === 'dark'" class="size-[18px] shrink-0" />
    <Monitor v-else class="size-[18px] shrink-0" />
    <span v-if="!collapsed">{{ currentLabel }}</span>
  </button>
</template>
