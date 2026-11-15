<script setup lang="ts">
import { tokenizeCode, type CodeLine } from '~/utils/codeHighlight'

const props = withDefaults(defineProps<{
  code: string
  language?: string
  lineNumbers?: boolean
  maxHeight?: string
  /** 超过此长度直接退回纯文本渲染，避免超大文件生成过多 DOM 节点。 */
  plainThreshold?: number
}>(), {
  language: 'javascript',
  lineNumbers: true,
  maxHeight: '620px',
  plainThreshold: 120_000,
})

const source = computed(() => props.code || '')
const tooLarge = computed(() => source.value.length > props.plainThreshold)
const lines = computed<CodeLine[]>(() => tooLarge.value ? [] : tokenizeCode(source.value, props.language))
</script>

<template>
  <div class="code-highlight" :style="{ '--ch-max-height': maxHeight }">
    <div v-if="!source" class="code-highlight__empty">暂无代码</div>
    <pre v-else-if="tooLarge" class="code-highlight__pre code-highlight__plain"><code>{{ source }}</code></pre>
    <pre v-else class="code-highlight__pre"><code><span
      v-for="(line, index) in lines"
      :key="index"
      class="ch-line"
    ><span v-if="lineNumbers" class="ch-no" aria-hidden="true">{{ index + 1 }}</span><span class="ch-text"><span
      v-for="(token, part) in line.tokens"
      :key="part"
      :class="'ch-' + token.kind"
    >{{ token.text }}</span></span></span></code></pre>
  </div>
</template>

<style scoped>
.code-highlight {
  --ch-keyword: #cf222e;
  --ch-string: #0a3069;
  --ch-comment: #6e7781;
  --ch-number: #0550ae;
  --ch-preprocessor: #8250df;
  --ch-function: #8250df;
  --ch-constant: #0550ae;
  --ch-type: #953800;
  --ch-operator: #cf222e;
  --ch-punctuation: #57606a;
  min-width: 0;
  border: 1px solid var(--colorNeutralStroke2);
  border-radius: var(--borderRadiusLarge);
  background: var(--colorNeutralBackground2);
  overflow: hidden;
}
.code-highlight__pre {
  margin: 0;
  max-height: var(--ch-max-height);
  overflow: auto;
  padding: 14px 0;
  font-family: var(--fontFamilyMonospace);
  font-size: 12.5px;
  line-height: 1.9; /* 行距比旧版 1.6 更宽松 */
  tab-size: 4;
}
.code-highlight__pre code { display: block; min-width: max-content; font: inherit; color: var(--colorNeutralForeground1); }
.ch-line { display: flex; align-items: baseline; min-height: 1.9em; padding: 1px 0; }
.ch-no {
  flex: 0 0 auto;
  width: 3.4em;
  padding-right: 12px;
  color: var(--colorNeutralForeground4);
  text-align: right;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
.ch-text { flex: 1 1 auto; padding-right: 18px; white-space: pre; }
.ch-keyword { color: var(--ch-keyword); font-weight: 600; }
.ch-string { color: var(--ch-string); }
.ch-comment { color: var(--ch-comment); font-style: italic; }
.ch-number, .ch-constant { color: var(--ch-number); }
.ch-preprocessor, .ch-function { color: var(--ch-preprocessor); }
.ch-type { color: var(--ch-type); }
.ch-operator, .ch-punctuation { color: var(--ch-punctuation); }
.code-highlight__plain code { padding: 0 18px; white-space: pre; }
.code-highlight__empty { padding: 24px; color: var(--colorNeutralForeground3); font-size: 13px; text-align: center; }
:global(html.dark .code-highlight) {
  --ch-keyword: #ff7b72;
  --ch-string: #a5d6ff;
  --ch-comment: #8b949e;
  --ch-number: #79c0ff;
  --ch-preprocessor: #d2a8ff;
  --ch-function: #d2a8ff;
  --ch-constant: #79c0ff;
  --ch-type: #ffa657;
  --ch-operator: #ff7b72;
  --ch-punctuation: #b1bac4;
}
</style>
