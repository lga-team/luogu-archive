<script setup lang="ts">
import type { PluginSnapshot, PluginTag } from '~/types/plugin'
import { PLUGIN_CODE_COPY_MAX_BYTES } from '~/utils/pluginCode'

const model = defineModel<PluginSnapshot>({ required: true })
const props = defineProps<{ tags: PluginTag[] }>()

const codeBytes = computed(() => new TextEncoder().encode(model.value.code || '').length)
const codeTooLarge = computed(() => codeBytes.value > 5 * 1024 * 1024)
const copyRestricted = computed(() => codeBytes.value > PLUGIN_CODE_COPY_MAX_BYTES)
const codeSizeText = computed(() => {
  if (codeBytes.value < 1024) return `${codeBytes.value} B`
  if (codeBytes.value < 1024 * 1024) return `${(codeBytes.value / 1024).toFixed(1)} KiB`
  return `${(codeBytes.value / 1024 / 1024).toFixed(2)} MiB`
})

const runtimeOptions = [
  { value: 'userscript', label: '用户脚本' },
  { value: 'extension', label: '浏览器扩展' },
  { value: 'bookmarklet', label: '书签脚本' },
  { value: 'other', label: '其他' },
]

function toggleTag(tagId: number, checked: boolean) {
  const values = new Set(model.value.tag_ids)
  if (checked) values.add(tagId)
  else values.delete(tagId)
  model.value.tag_ids = [...values]
}
</script>

<template>
  <div class="snapshot-form">
    <section class="form-section">
      <h2 class="section-title">基本信息</h2>
      <div class="stack stack--xs">
        <label for="plugin-summary" class="field-label">简短介绍（可选）</label>
        <FTextarea id="plugin-summary" v-model.trim="model.summary" :maxlength="50" :rows="2" placeholder="留空时从文章正文中自动生成" />
      </div>
      <div class="stack stack--xs">
        <span class="field-label">功能标签（可不选）</span>
        <div class="choice-row">
          <FCheckbox
            v-for="tag in props.tags"
            :key="tag.id"
            :model-value="model.tag_ids.includes(tag.id)"
            :label="tag.name"
            @update:model-value="toggleTag(tag.id, $event)"
          />
        </div>
        <span v-if="!props.tags.length" class="field-help">暂时没有可用标签。</span>
      </div>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h2 class="section-title">代码</h2>
        <span :class="{ 'danger-text': codeTooLarge }">{{ codeSizeText }} / 5 MiB</span>
      </div>
      <div class="form-grid two">
        <div class="stack stack--xs">
          <label for="plugin-version" class="field-label">代码版本</label>
          <FInput id="plugin-version" v-model.trim="model.version" :maxlength="64" placeholder="例如 1.0.0" required />
        </div>
        <div class="stack stack--xs">
          <label for="plugin-filename" class="field-label">下载文件名</label>
          <FInput id="plugin-filename" v-model.trim="model.download_filename" :maxlength="128" placeholder="plugin.user.js" required />
        </div>
      </div>
      <div class="stack stack--xs">
        <label for="plugin-code" class="field-label">代码内容</label>
        <FTextarea id="plugin-code" v-model="model.code" class="code-input" :rows="18" placeholder="粘贴完整代码" required />
        <span class="field-help">发布后用户可复制或下载；超过 5 MiB 将无法提交。</span>
      </div>
      <div v-if="copyRestricted" class="notice notice--warn">
        完整代码超过 100 KiB，发布后公开页面将禁用复制，只允许下载。
      </div>
    </section>

    <section class="form-section">
      <h2 class="section-title">运行与兼容</h2>
      <div class="form-grid two">
        <div class="stack stack--xs">
          <label for="plugin-runtime" class="field-label">运行方式</label>
          <FSelect id="plugin-runtime" v-model="model.runtime_mode" :options="runtimeOptions" />
        </div>
        <div class="stack stack--xs">
          <label for="plugin-verified" class="field-label">最后验证日期</label>
          <input id="plugin-verified" v-model="model.last_verified_on" type="date" class="input" required>
        </div>
      </div>
      <div class="stack stack--xs">
        <span class="field-label">兼容设备</span>
        <div class="choice-row">
          <FCheckbox v-model="model.supports_desktop" label="桌面端" />
          <FCheckbox v-model="model.supports_mobile" label="移动端" />
        </div>
      </div>
    </section>

    <section class="form-section">
      <h2 class="section-title">请求说明</h2>
      <div class="level-editor" :class="`level-${model.user_request_level}`">
        <div class="level-heading">
          <span class="field-label">用户提交的请求等级</span>
          <PluginRequestLevelBadge :level="model.user_request_level" />
        </div>
        <FSlider v-model="model.user_request_level" :min="0" :max="3" :step="1" aria-label="用户提交的请求等级" />
        <div class="level-ticks" aria-hidden="true"><span>0</span><span>1</span><span>2</span><span>3</span></div>
      </div>
      <p class="field-help">
        建议说明访问的域名或接口、触发方式、单次请求数量、周期刷新或并发行为，以及是否读取 Cookie、Token、localStorage 或向第三方发送数据。
      </p>
      <PluginMarkdownEditor
        v-model="model.user_request_analysis"
        label="上传者请求分析"
        :maxlength="20000"
        placeholder="使用 Markdown 描述插件的网络请求行为"
      />
    </section>
  </div>
</template>

<style scoped>
.snapshot-form { display: flex; flex-direction: column; gap: 24px; }
.form-section { display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; border-bottom: 1px solid var(--colorNeutralStroke2); }
.form-section:last-child { border-bottom: 0; padding-bottom: 0; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.section-heading span { color: var(--colorNeutralForeground3); font-size: 12px; }
.section-heading .danger-text { font-weight: 600; }
.form-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.choice-row { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.code-input :deep(fluent-textarea) { font-family: var(--fontFamilyMonospace); }
.level-editor {
  --level-color: #2da44e;
  display: flex; flex-direction: column; gap: 6px; padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--level-color) 55%, var(--colorNeutralStroke2));
  border-radius: var(--borderRadiusLarge);
  background: color-mix(in srgb, var(--level-color) 7%, var(--colorNeutralBackground1));
}
.level-editor.level-1 { --level-color: #6c8f1c; }
.level-editor.level-2 { --level-color: #a87900; }
.level-editor.level-3 { --level-color: #c0392b; }
.level-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.level-ticks { display: flex; justify-content: space-between; padding: 0 2px; color: var(--colorNeutralForeground3); font-size: 11px; }
@media (max-width: 700px) { .form-grid.two { grid-template-columns: minmax(0, 1fr); } }
</style>
