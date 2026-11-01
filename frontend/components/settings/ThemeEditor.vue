<script setup lang="ts">
import { Download, Upload, Link, Plus, Minus, RotateCcw, Save, X, LoaderCircle, Palette } from 'lucide-vue-next'
import Choice from './ThemeChoiceField.vue'
import Color from './ThemeColorField.vue'
import Range from './ThemeRangeField.vue'

const props = defineProps<{ resolvedTheme: string }>()
const {
  draft, config, bodyConfig: b, imageOptions: o, link, busy, message, error, imageFallback,
  imageInput, imageEnabled, operation, dirty, update, body, opts, importLink, save,
  importJson, exportJson, cancel, reset, importWithoutImage, setImageEnabled, commitImage, clearImage, setSize,
} = useThemeEditor()
const file = ref<HTMLInputElement | null>(null)
</script>

<template>
  <section class="card theme-editor" aria-label="洛谷主题编辑">
    <div class="card__header">
      <div>
        <h2 class="card__title" style="display: flex; align-items: center; gap: 8px">
          <Palette :size="18" aria-hidden="true" />洛谷主题
        </h2>
        <p class="card__description">导入洛谷主题编号，或手动调整导航与中景配色。</p>
      </div>
      <span v-if="dirty" class="tag tag--warn">有未保存修改</span>
    </div>

    <div class="card__body stack stack--lg">
      <div v-if="props.resolvedTheme === 'dark'" class="notice">
        <span>暗色模式使用纯色背景。切换到浅色模式后即可编辑并预览洛谷主题。</span>
      </div>

      <template v-else>
        <div class="theme-switch-row">
          <div class="stack stack--xs">
            <strong style="font-size: 14px">启用自定义主题</strong>
            <span class="field-help">关闭后恢复 Fluent 默认的浅色外观。</span>
          </div>
          <FSwitch
            :model-value="draft.enabled"
            :disabled="busy"
            aria-label="启用自定义主题"
            @update:model-value="update(theme => { theme.enabled = $event })"
          />
        </div>

        <div class="divider" />

        <form class="stack" @submit.prevent="importLink()">
          <label for="theme-link" class="field-label">从洛谷导入</label>
          <div class="theme-import-row">
            <FInput
              id="theme-link"
              v-model="link"
              placeholder="主题编号或链接，例如 12345"
              :disabled="busy"
              aria-label="洛谷主题编号或链接"
              @enter="importLink()"
            />
            <FButton type="submit" appearance="primary" :disabled="busy">
              <template #start><Link :size="15" aria-hidden="true" /></template>导入
            </FButton>
            <FButton appearance="outline" :disabled="busy || !link" title="重新抓取洛谷最新配置" @click="importLink(true)">
              <template #start><RotateCcw :size="15" aria-hidden="true" /></template>重新导入
            </FButton>
          </div>
        </form>

        <div class="theme-feedback" aria-live="polite">
          <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true" />
          <span v-if="message" role="status">{{ message }}</span>
          <span v-if="error" role="alert" class="field-error">{{ error }}</span>
          <FButton v-if="busy && operation" appearance="subtle" size="small" @click="operation?.abort()">取消等待</FButton>
        </div>

        <FButton v-if="imageFallback" appearance="outline" :disabled="busy" @click="importWithoutImage">
          不使用背景图片导入
        </FButton>

        <fieldset :disabled="busy" class="theme-editor-panel">
          <div class="theme-field stack stack--xs">
            <label for="theme-name" class="field-label">主题名称</label>
            <FInput
              id="theme-name"
              :model-value="draft.name"
              :maxlength="100"
              @update:model-value="update(theme => { theme.name = String($event ?? '') })"
            />
            <span v-if="draft.author" class="field-help">原主题作者：{{ draft.author }}</span>
          </div>

          <section class="theme-group">
            <h3 class="theme-group__title">亮色导航</h3>
            <div class="grid grid--3">
              <Color label="导航背景" :model-value="config.lNavi.back" @update:model-value="update(theme => { theme.config.lNavi.back = $event })" />
              <Color label="文字颜色" :model-value="config.lNavi.fore" @update:model-value="update(theme => { theme.config.lNavi.fore = $event })" />
              <div class="stack stack--sm">
                <Choice
                  label="Logo 颜色"
                  :model-value="config.lNavi.logo ? 'custom' : 'color'"
                  :options="[['color', '彩色'], ['custom', '自定义']]"
                  @update:model-value="update(theme => { theme.config.lNavi.logo = $event === 'custom' ? '#ffffff' : null })"
                />
                <Color
                  v-if="config.lNavi.logo"
                  label="Logo 自定义颜色"
                  :model-value="config.lNavi.logo"
                  @update:model-value="update(theme => { theme.config.lNavi.logo = $event })"
                />
              </div>
            </div>
          </section>

          <section class="theme-group">
            <h3 class="theme-group__title">亮色主体</h3>
            <div class="grid grid--2">
              <Color label="背景底色" :model-value="b.back" @update:model-value="body('back', $event)" />

              <div class="theme-field stack stack--xs">
                <span class="field-label">中景颜色</span>
                <div class="theme-color-list">
                  <Color
                    v-for="(value, index) in b.color"
                    :key="index"
                    :label="'颜色 ' + (index + 1)"
                    :model-value="value"
                    removable
                    @update:model-value="body('color', b.color.map((old, i) => i === index ? $event : old))"
                    @remove="body('color', b.color.filter((_, i) => i !== index))"
                  />
                </div>
                <div class="cluster">
                  <FButton appearance="outline" size="small" :disabled="b.color.length >= 20" @click="body('color', [...b.color, '#ffffff'])">
                    <template #start><Plus :size="14" /></template>增加
                  </FButton>
                  <FButton appearance="subtle" size="small" :disabled="!b.color.length" @click="body('color', b.color.slice(0, -1))">
                    <template #start><Minus :size="14" /></template>移除
                  </FButton>
                </div>
              </div>

              <Range label="渐变角度" :model-value="o.degree" :max="360" unit="°" @update:model-value="opts('degree', $event)" />
              <Choice
                label="中景淡出"
                :model-value="String(b.fade)"
                :options="[['1', '从上淡出'], ['-1', '从下淡出'], ['0', '全屏']]"
                @update:model-value="body('fade', Number($event))"
              />
              <Range label="中景亮度" :model-value="o.brightness" :min="-100" @update:model-value="opts('brightness', $event)" />
              <Choice
                label="卡片毛玻璃"
                :model-value="String(b.blur)"
                :options="[['0', '关闭'], ['1000', '标准'], ['1010', '轻量']]"
                @update:model-value="body('blur', Number($event) as 0 | 1000 | 1010)"
              />

              <div class="span-2 stack stack--sm">
                <div class="theme-switch-row">
                  <span class="field-label">中景图片</span>
                  <FSwitch :model-value="imageEnabled" aria-label="启用中景图片" @update:model-value="setImageEnabled" />
                </div>
                <div class="theme-import-row">
                  <FInput
                    v-model="imageInput"
                    type="url"
                    :disabled="!imageEnabled"
                    placeholder="https://…/{d}.png"
                    aria-label="中景图片地址"
                    @change="commitImage"
                  />
                  <FButton appearance="outline" @click="clearImage">清除</FButton>
                </div>
                <span class="field-help">支持 {y}/{m}/{d}/{w} 年／月／日／星期占位符。外部图片由浏览器加载。</span>
              </div>

              <Choice
                label="图片重复"
                :model-value="o.repeat"
                :options="[['none', '不重复'], ['all', '全部重复'], ['x', '横向重复'], ['y', '纵向重复']]"
                @update:model-value="opts('repeat', $event)"
              />

              <div class="stack stack--sm">
                <Choice
                  label="图片尺寸"
                  :model-value="['auto', 'cover', 'contain'].includes(o.size) ? o.size : 'custom'"
                  :options="[['auto', '自动'], ['cover', '填充'], ['contain', '适应'], ['custom', '自定义']]"
                  @update:model-value="opts('size', $event === 'custom' ? '100 0' : $event)"
                />
                <div v-if="!['auto', 'cover', 'contain'].includes(o.size)" class="form-grid">
                  <div v-for="index in [0, 1]" :key="index" class="stack stack--xs">
                    <label :for="'theme-size-' + index" class="field-label">{{ index ? '高度' : '宽度' }}（%，0 为自动）</label>
                    <FInput
                      :id="'theme-size-' + index"
                      :model-value="o.size.split(/\s+/)[index] || '0'"
                      @update:model-value="setSize(index, $event)"
                    />
                  </div>
                </div>
              </div>

              <Range label="图片位置 X" :model-value="o.position[0] ?? 0" @update:model-value="opts('position', [$event, o.position[1] ?? 0])" />
              <Range label="图片位置 Y" :model-value="o.position[1] ?? 0" @update:model-value="opts('position', [o.position[0] ?? 0, $event])" />
            </div>
          </section>
        </fieldset>

        <div class="theme-editor-footer">
          <div class="cluster">
            <FButton appearance="primary" :disabled="busy || !dirty" @click="save">
              <template #start><Save :size="16" aria-hidden="true" /></template>保存主题
            </FButton>
            <FButton appearance="outline" :disabled="busy || !dirty" @click="cancel">
              <template #start><X :size="16" aria-hidden="true" /></template>取消
            </FButton>
            <FButton appearance="subtle" :disabled="busy" @click="reset">
              <template #start><RotateCcw :size="16" aria-hidden="true" /></template>恢复默认
            </FButton>
          </div>
          <div class="cluster">
            <input ref="file" type="file" accept=".json,application/json" hidden @change="importJson">
            <FButton appearance="outline" :disabled="busy" @click="file?.click()">
              <template #start><Upload :size="16" aria-hidden="true" /></template>导入 JSON
            </FButton>
            <FButton appearance="outline" :disabled="busy" @click="exportJson">
              <template #start><Download :size="16" aria-hidden="true" /></template>导出 JSON
            </FButton>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.theme-editor-panel { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
.theme-group { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; border-top: 1px solid var(--colorNeutralStroke2); }
.theme-group__title { font-size: 14px; font-weight: 600; color: var(--colorNeutralForeground2); }
.theme-field { min-width: 0; }
.theme-import-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.theme-import-row > :first-child { flex: 1 1 260px; min-width: 0; }
.theme-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.theme-feedback { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 20px; font-size: 13px; color: var(--colorNeutralForeground3); }
.theme-color-list { display: flex; flex-direction: column; gap: 8px; }
.theme-editor-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding-top: 14px; border-top: 1px solid var(--colorNeutralStroke2);
}
.spin { animation: theme-spin 1s linear infinite; }
@keyframes theme-spin { to { transform: rotate(360deg); } }
@media (max-width: 680px) {
  .theme-import-row > * { width: 100%; }
  .theme-editor-footer { align-items: stretch; flex-direction: column; }
}
</style>
