<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  size?: 'small' | 'medium' | 'large'
  appearance?: 'outline' | 'underline' | 'filled-lighter' | 'filled-darker'
  ariaLabel?: string
  name?: string
}>(), { size: 'medium', placeholder: '请选择' })

const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [string] }>()
const uid = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)
const panelStyle = ref<Record<string, string>>({})

const selectedIndex = computed(() => props.options.findIndex(option => option.value === props.modelValue))
const selectedLabel = computed(() => selectedIndex.value >= 0 ? props.options[selectedIndex.value].label : '')
const panelId = computed(() => 'f-select-panel-' + uid)
const optionId = (index: number) => 'f-select-option-' + uid + '-' + index

function position() {
  const el = trigger.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const width = Math.max(rect.width, 180)
  const below = window.innerHeight - rect.bottom
  const placeAbove = below < 240 && rect.top > below
  const style: Record<string, string> = {
    left: Math.min(rect.left, Math.max(8, window.innerWidth - width - 8)) + 'px',
    width: width + 'px',
  }
  if (placeAbove) style.bottom = (window.innerHeight - rect.top + 4) + 'px'
  else style.top = (rect.bottom + 4) + 'px'
  panelStyle.value = style
}

function openPanel() {
  if (props.disabled) return
  open.value = true
  activeIndex.value = Math.max(0, selectedIndex.value)
  nextTick(position)
}
function closePanel(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  activeIndex.value = -1
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}
function toggle() {
  if (props.disabled) return
  if (open.value) closePanel()
  else openPanel()
}
function choose(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closePanel(true)
}
function moveActive(delta: number) {
  const count = props.options.length
  if (!count) return
  let next = activeIndex.value
  for (let attempt = 0; attempt < count; attempt += 1) {
    next = (next + delta + count) % count
    if (!props.options[next]?.disabled) { activeIndex.value = next; return }
  }
}
function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openPanel()
    }
    return
  }
  if (event.key === 'Escape') { event.preventDefault(); closePanel(true) }
  else if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1) }
  else if (event.key === 'Home') { event.preventDefault(); activeIndex.value = 0 }
  else if (event.key === 'End') { event.preventDefault(); activeIndex.value = props.options.length - 1 }
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.options[activeIndex.value]
    if (option) choose(option)
  }
}
function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  closePanel()
}
function onViewportChange() { closePanel() }

watch(open, value => {
  if (!import.meta.client) return
  if (value) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
  }
})
watch(() => props.modelValue, () => closePanel())
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <span
    ref="root"
    class="f-select"
    :class="['f-select--' + size, 'f-select--' + (appearance || 'outline'), { 'is-open': open, 'is-disabled': disabled }]"
  >
    <button
      ref="trigger"
      type="button"
      class="f-select__trigger"
      role="combobox"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :disabled="disabled"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="f-select__value" :class="{ 'is-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
      <ChevronDown class="f-select__chevron" :size="16" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <Transition name="f-select-pop">
        <div
          v-if="open"
          :id="panelId"
          ref="panel"
          class="f-select__panel"
          :style="panelStyle"
          role="listbox"
          :aria-label="ariaLabel || placeholder"
          @mousedown.prevent
        >
          <button
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="option.value"
            type="button"
            class="f-select__option"
            :class="{ 'is-active': index === activeIndex, 'is-selected': option.value === modelValue, 'is-disabled': option.disabled }"
            role="option"
            :aria-selected="option.value === modelValue"
            :disabled="option.disabled"
            @mouseenter="!option.disabled && (activeIndex = index)"
            @click="choose(option)"
          >
            <span class="f-select__option-label">{{ option.label }}</span>
            <Check v-if="option.value === modelValue" :size="15" aria-hidden="true" />
          </button>
          <div v-if="!options.length" class="f-select__empty">暂无选项</div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.f-select { position: relative; display: inline-flex; width: 100%; min-width: 0; max-width: 100%; vertical-align: middle; }
.f-select__trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; min-width: 0; height: 32px; padding: 0 9px 0 11px;
  border: 1px solid var(--colorNeutralStroke1); border-bottom-color: var(--colorNeutralStrokeAccessible);
  border-radius: var(--borderRadiusMedium); background: var(--colorNeutralBackground1);
  color: var(--colorNeutralForeground1); font-family: inherit; font-size: var(--fontSizeBase300); line-height: 1.4;
  text-align: left; cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
}
.f-select__trigger:hover { border-color: var(--colorNeutralStroke1Hover); background: var(--colorNeutralBackground1Hover); }
.f-select__trigger:focus-visible { outline: none; border-color: var(--colorBrandStroke1); box-shadow: inset 0 -2px 0 var(--colorBrandStroke1); }
.f-select.is-open .f-select__trigger { border-color: var(--colorBrandStroke1); box-shadow: inset 0 -2px 0 var(--colorBrandStroke1); }
.f-select__trigger:disabled { cursor: not-allowed; color: var(--colorNeutralForegroundDisabled); background: var(--colorNeutralBackgroundDisabled); border-color: var(--colorNeutralStrokeDisabled); }
.f-select__value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.f-select__value.is-placeholder { color: var(--colorNeutralForeground4); }
.f-select__chevron { flex-shrink: 0; color: var(--colorNeutralForeground3); transition: transform 180ms cubic-bezier(.4,0,.2,1); }
.f-select.is-open .f-select__chevron { transform: rotate(180deg); }
.f-select--small .f-select__trigger { height: 28px; font-size: var(--fontSizeBase200); }
.f-select--large .f-select__trigger { height: 40px; font-size: var(--fontSizeBase400); }
.f-select--underline .f-select__trigger { border: 0; border-bottom: 1px solid var(--colorNeutralStrokeAccessible); border-radius: 0; background: transparent; }
.f-select--filled-lighter .f-select__trigger { background: var(--colorNeutralBackground2); }
.f-select--filled-darker .f-select__trigger { background: var(--colorNeutralBackground3); }

.f-select__panel {
  position: fixed; z-index: 2000; max-height: min(300px, 60dvh); overflow-y: auto; padding: 4px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: var(--borderRadiusLarge);
  background: var(--colorNeutralBackground1); box-shadow: var(--shadow16); transform-origin: top left;
}
.f-select__option {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; min-height: 32px; padding: 5px 9px;
  border: 0; border-radius: var(--borderRadiusMedium); background: transparent;
  color: var(--colorNeutralForeground1); font: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.f-select__option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.f-select__option.is-active { background: var(--colorNeutralBackground1Hover); }
.f-select__option.is-selected { background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-weight: 600; }
.f-select__option.is-disabled { opacity: .45; cursor: not-allowed; }
.f-select__option svg { flex-shrink: 0; color: var(--colorBrandForeground1); }
.f-select__empty { padding: 10px; color: var(--colorNeutralForeground3); font-size: 12px; text-align: center; }
.f-select-pop-enter-active { transition: opacity 120ms ease, transform 150ms cubic-bezier(.4,0,.2,1); }
.f-select-pop-leave-active { transition: opacity 90ms ease, transform 90ms ease; }
.f-select-pop-enter-from, .f-select-pop-leave-to { opacity: 0; transform: translateY(-3px) scale(.985); }
@media (max-width: 680px) { .f-select__panel { max-height: min(260px, 50dvh); } }
</style>
