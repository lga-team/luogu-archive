<script setup lang="ts">
const model = defineModel<string>({ required: true })
defineProps<{ label: string; placeholder?: string; maxlength?: number }>()

const mode = ref('write')
const tabs = [
  { id: 'write', label: '编辑' },
  { id: 'preview', label: '预览' },
]
const { render } = useMarkdown()
const previewHtml = computed(() => render(model.value || ''))
</script>

<template>
  <div class="markdown-editor">
    <div class="editor-head">
      <span class="field-label">{{ label }}</span>
      <FTabList v-model="mode" :tabs="tabs" size="small" :aria-label="label + '编辑模式'" style="width: auto" />
    </div>
    <FTextarea
      v-if="mode === 'write'"
      v-model="model"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :rows="12"
      aria-label="Markdown 内容"
    />
    <div v-else class="preview markdown-body" v-html="previewHtml" />
  </div>
</template>

<style scoped>
.markdown-editor { display: flex; flex-direction: column; gap: 8px; }
.editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.editor-head :deep(fluent-tablist) { width: auto; }
.preview {
  min-height: 220px; border: 1px solid var(--colorNeutralStroke2);
  border-radius: var(--borderRadiusLarge); padding: 12px 14px;
  background: var(--colorNeutralBackground1);
}
</style>
