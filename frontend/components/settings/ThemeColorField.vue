<script setup lang="ts">
import { useId } from 'vue'
import { Minus } from 'lucide-vue-next'
import { normalizeTheme } from '~/lib/luoguTheme'

defineProps<{ label: string; removable?: boolean }>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ remove: [] }>()
const id = useId()
const text = ref(model.value)
const invalid = ref(false)

watch(model, value => { text.value = value; invalid.value = false })

function commit(value: string | number | undefined) {
  text.value = String(value ?? '')
  try {
    normalizeTheme({ lNavi: { back: text.value } })
    model.value = text.value
    invalid.value = false
  } catch {
    invalid.value = true
  }
}
</script>

<template>
  <div class="theme-field stack stack--xs">
    <label :for="id" class="field-label">{{ label }}</label>
    <div class="theme-color-row">
      <input
        type="color"
        class="theme-swatch"
        :aria-label="label + ' 色板'"
        :value="/^#[\da-f]{6}$/i.test(model) ? model : '#ffffff'"
        @input="commit(($event.target as HTMLInputElement).value)"
      >
      <FInput
        :id="id"
        :model-value="text"
        :aria-invalid="invalid"
        aria-label="颜色值"
        @update:model-value="commit"
        @change="commit(text)"
      />
      <FButton v-if="removable" appearance="subtle" icon-only :title="'移除' + label" :aria-label="'移除' + label" @click="emit('remove')">
        <Minus :size="16" aria-hidden="true" />
      </FButton>
    </div>
    <span v-if="invalid" class="field-error">颜色格式不正确</span>
  </div>
</template>

<style scoped>
.theme-color-row { display: flex; align-items: center; gap: 8px; }
.theme-swatch {
  width: 34px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--colorNeutralStroke1);
  border-radius: var(--borderRadiusMedium);
  background: var(--colorNeutralBackground1);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
