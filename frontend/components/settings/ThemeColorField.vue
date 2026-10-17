<script setup lang="ts">
import { useId } from 'vue'
import { Minus } from 'lucide-vue-next'
import { Input, Label, Button } from '../ui'
import { normalizeTheme } from '~/utils/luoguTheme'
defineProps<{ label: string; removable?: boolean }>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ remove: [] }>()
const id = useId()
const text = ref(model.value)
const invalid = ref(false)
watch(model, value => { text.value = value; invalid.value = false })
function commit(value: string | number | undefined) {
  text.value = String(value ?? '')
  try { normalizeTheme({ lNavi: { back: text.value } }); model.value = text.value; invalid.value = false }
  catch { invalid.value = true }
}
</script>
<template>
  <div class="theme-field"><Label :for="id">{{ label }}</Label><div class="theme-color-row">
    <Input type="color" :aria-label="label + '色板'" class="theme-swatch" :model-value="/^#[\da-f]{6}$/i.test(model) ? model : '#ffffff'" @update:model-value="commit" />
    <Input :id="id" :aria-invalid="invalid" :model-value="text" @update:model-value="commit" @blur="commit(text)" />
    <Button v-if="removable" size="icon" variant="ghost" :title="'移除' + label" :aria-label="'移除' + label" @click="emit('remove')"><Minus :size="16" /></Button>
  </div><span v-if="invalid" class="archive-error">颜色格式不正确</span></div>
</template>
