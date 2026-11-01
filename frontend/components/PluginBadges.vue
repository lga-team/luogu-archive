<script setup lang="ts">
import { BadgeCheck, Sparkles } from 'lucide-vue-next'
import type { PluginTag } from '~/types/plugin'

withDefaults(defineProps<{
  isOfficial?: boolean
  isRecommended?: boolean
  tags?: readonly Pick<PluginTag, 'id' | 'name'>[]
}>(), { isOfficial: false, isRecommended: false, tags: () => [] })
</script>

<template>
  <div v-if="isOfficial || isRecommended || tags.length" class="plugin-badges">
    <span v-if="isOfficial" class="trust official"><BadgeCheck :size="13" aria-hidden="true" />官方插件</span>
    <span v-if="isRecommended" class="trust recommended"><Sparkles :size="13" aria-hidden="true" />推荐插件</span>
    <span v-for="tag in tags" :key="tag.id" class="plugin-tag">{{ tag.name }}</span>
  </div>
</template>

<style scoped>
.plugin-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.trust, .plugin-tag { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 7px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.official { color: var(--link); border-color: color-mix(in srgb, var(--link) 30%, var(--border)); background: color-mix(in srgb, var(--link) 7%, var(--surface)); }
.recommended { color: var(--text); border-color: color-mix(in srgb, var(--lg-yellow) 65%, var(--border)); background: color-mix(in srgb, var(--lg-yellow) 15%, var(--surface)); }
.trust svg { flex-shrink: 0; }
.plugin-tag { color: var(--text-muted); }
</style>
