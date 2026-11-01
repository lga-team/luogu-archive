<!-- 管理组提示独立于文章正文，普通文章页和插件原文使用同一套展示。 -->
<script setup lang="ts">
defineProps<{ note?: string | null }>()
</script>

<template>
  <div v-if="note" class="admin-note" role="note">
    <strong class="admin-note__title">管理组提示</strong>
    <MarkdownBody :source="note" class="markdown-body admin-note__content" />
  </div>
</template>

<style scoped>
.admin-note {
  margin: 0 0 20px;
  padding: 14px 16px;
  border-radius: var(--borderRadiusLarge);
  border: 1px solid color-mix(in srgb, var(--colorPaletteRedForeground1, #b10e1c) 24%, transparent);
  background: color-mix(in srgb, var(--colorPaletteRedBackground1, #fde7e9) 70%, var(--colorNeutralBackground1));
  color: var(--colorNeutralForeground1);
  overflow-wrap: anywhere;
}
.admin-note__title { display: block; margin-bottom: 6px; font-size: 13px; color: var(--colorPaletteRedForeground1, #b10e1c); }
.admin-note__content { font-size: 14px; line-height: 1.7; }
.admin-note__content :deep(> :first-child) { margin-top: 0; }
.admin-note__content :deep(> :last-child) { margin-bottom: 0; }
</style>
