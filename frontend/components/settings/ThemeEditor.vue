<script setup lang="ts">
import { Download, Upload, Link, Plus, Minus, RotateCcw, Save, X, LoaderCircle } from 'lucide-vue-next'
import { Button, Input, Label, Switch } from '../ui'
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
  <section class="theme-editor" aria-label="洛谷主题编辑">
    <p v-if="props.resolvedTheme === 'dark'" class="archive-muted">暗色模式使用纯色背景，切换到亮色模式后可编辑主题。</p>
    <template v-else>
      <div class="settings-section-heading"><h2>亮色主题</h2><div class="theme-choice"><Label for="theme-enabled">启用主题</Label><Switch id="theme-enabled" :model-value="draft.enabled" :disabled="busy" @update:model-value="update(theme => { theme.enabled = $event })" /></div></div>
      <form class="theme-import" @submit.prevent="importLink()"><Label for="theme-link">洛谷主题编号或链接</Label><div class="theme-import-row"><Input id="theme-link" v-model="link" type="text" :disabled="busy" required /><Button type="submit" :disabled="busy"><Link :size="16" />导入</Button><Button variant="outline" :disabled="busy || !link" title="重新抓取洛谷最新配置" @click="importLink(true)"><RotateCcw :size="16" />重新导入</Button></div></form>
      <div class="theme-feedback" aria-live="polite"><LoaderCircle v-if="busy" class="settings-spin" :size="16" /><span v-if="message" role="status">{{ message }}</span><span v-if="error" role="alert" class="archive-error">{{ error }}</span><Button v-if="busy && operation" variant="ghost" size="sm" @click="operation?.abort()">取消等待</Button></div>
      <Button v-if="imageFallback" variant="outline" :disabled="busy" @click="importWithoutImage">不使用背景图片导入</Button>
      <fieldset :disabled="busy" class="theme-editor-panel">
        <div class="theme-field"><Label for="theme-name">主题名称</Label><Input id="theme-name" :model-value="draft.name" :maxlength="100" @update:model-value="update(theme => { theme.name = String($event ?? '') })" /><span v-if="draft.author" class="archive-muted">原主题作者：{{ draft.author }}</span></div>
        <h3>亮色导航</h3><div class="theme-grid theme-grid-three">
          <Color label="导航背景" :model-value="config.lNavi.back" @update:model-value="update(theme => { theme.config.lNavi.back = $event })" />
          <Color label="文字颜色" :model-value="config.lNavi.fore" @update:model-value="update(theme => { theme.config.lNavi.fore = $event })" />
          <div class="theme-logo-controls"><Choice label="Logo 颜色" :model-value="config.lNavi.logo ? 'custom' : 'color'" :options="[['color', '彩色'], ['custom', '自定义']]" @update:model-value="update(theme => { theme.config.lNavi.logo = $event === 'custom' ? '#ffffff' : null })" /><Color v-if="config.lNavi.logo" label="Logo 自定义颜色" :model-value="config.lNavi.logo" @update:model-value="update(theme => { theme.config.lNavi.logo = $event })" /></div>
        </div>
        <h3>亮色主体</h3><div class="theme-grid">
          <Color label="背景底色" :model-value="b.back" @update:model-value="body('back', $event)" />
          <div class="theme-field"><Label>中景颜色</Label><div class="theme-color-list"><Color v-for="(value, index) in b.color" :key="index" :label="'颜色 ' + (index + 1)" :model-value="value" removable @update:model-value="body('color', b.color.map((old, i) => i === index ? $event : old))" @remove="body('color', b.color.filter((_, i) => i !== index))" /></div><div class="theme-actions"><Button variant="outline" size="icon" aria-label="增加中景颜色" title="增加中景颜色" :disabled="b.color.length >= 20" @click="body('color', [...b.color, '#ffffff'])"><Plus :size="16" /></Button><Button variant="outline" size="icon" aria-label="移除最后一个中景颜色" title="移除最后一个中景颜色" :disabled="!b.color.length" @click="body('color', b.color.slice(0, -1))"><Minus :size="16" /></Button></div></div>
          <Range label="渐变角度" :model-value="o.degree" :max="360" unit="°" @update:model-value="opts('degree', $event)" />
          <Choice label="中景淡出" :model-value="String(b.fade)" :options="[['1', '从上淡出'], ['-1', '从下淡出'], ['0', '全屏']]" @update:model-value="body('fade', Number($event))" />
          <Range label="中景亮度" :model-value="o.brightness" :min="-100" @update:model-value="opts('brightness', $event)" />
          <Choice label="卡片毛玻璃" :model-value="String(b.blur)" :options="[['0', '关闭'], ['1000', '标准'], ['1010', '轻量']]" @update:model-value="body('blur', Number($event) as 0 | 1000 | 1010)" />
          <div class="theme-field theme-full"><div class="theme-choice"><Label for="theme-image-enabled">中景图片</Label><Switch id="theme-image-enabled" :model-value="imageEnabled" @update:model-value="setImageEnabled" /></div><div class="theme-import-row"><Input v-model="imageInput" aria-label="中景图片地址" type="url" :disabled="!imageEnabled" placeholder="https://…/{d}.png" @blur="commitImage" /><Button variant="outline" @click="clearImage">清除</Button></div><span class="archive-muted">支持 {y}/{m}/{d}/{w} 年／月／日／星期占位符。外部图片由浏览器加载。</span></div>
          <Choice label="图片重复" :model-value="o.repeat" :options="[['none', '不重复'], ['all', '全部重复'], ['x', '横向重复'], ['y', '纵向重复']]" @update:model-value="opts('repeat', $event)" />
          <div class="theme-field"><Choice label="图片尺寸" :model-value="['auto', 'cover', 'contain'].includes(o.size) ? o.size : 'custom'" :options="[['auto', '自动'], ['cover', '填充'], ['contain', '适应'], ['custom', '自定义']]" @update:model-value="opts('size', $event === 'custom' ? '100 0' : $event)" />
            <div v-if="!['auto', 'cover', 'contain'].includes(o.size)" class="theme-size-fields"><div v-for="index in [0, 1]" :key="index" class="theme-field"><Label :for="'theme-size-' + index">{{ index ? '高度' : '宽度' }}（%，0 为自动）</Label><Input :id="'theme-size-' + index" type="number" :min="0" :max="9999" :model-value="o.size.split(/\s+/)[index] || '0'" @update:model-value="setSize(index, $event)" /></div></div>
          </div>
          <Range label="图片位置 X" :model-value="o.position[0] ?? 0" @update:model-value="opts('position', [$event, o.position[1] ?? 0])" />
          <Range label="图片位置 Y" :model-value="o.position[1] ?? 0" @update:model-value="opts('position', [o.position[0] ?? 0, $event])" />
        </div>
      </fieldset>
      <div class="theme-editor-footer"><div class="theme-actions">
        <Button :disabled="busy || !dirty" @click="save"><Save :size="16" />保存主题</Button>
        <Button variant="outline" :disabled="busy || !dirty" @click="cancel"><X :size="16" />取消</Button>
        <Button variant="outline" :disabled="busy" @click="reset"><RotateCcw :size="16" />恢复默认</Button>
      </div><div class="theme-actions"><input ref="file" type="file" accept=".json,application/json" hidden @change="importJson"><Button variant="outline" :disabled="busy" @click="file?.click()"><Upload :size="16" />导入 JSON</Button><Button variant="outline" :disabled="busy" @click="exportJson"><Download :size="16" />导出 JSON</Button></div></div>
    </template>
  </section>
</template>
