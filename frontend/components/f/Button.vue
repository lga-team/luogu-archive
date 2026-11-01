<script setup lang="ts">
withDefaults(defineProps<{
  appearance?: 'primary' | 'outline' | 'subtle' | 'transparent'
  size?: 'small' | 'medium' | 'large'
  shape?: 'rounded' | 'circular' | 'square'
  type?: 'button' | 'submit' | 'reset'
  href?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  rel?: string
  disabled?: boolean
  iconOnly?: boolean
  block?: boolean
  loading?: boolean
  ariaLabel?: string
}>(), {
  type: 'button',
  disabled: false,
  iconOnly: false,
  block: false,
  loading: false,
  rel: 'noopener noreferrer',
})

const emit = defineEmits<{ click: [MouseEvent] }>()

function onClick(event: MouseEvent) {
  emit('click', event)
}
function onAnchorClick(event: Event) {
  if ((event.currentTarget as HTMLElement).getAttribute('aria-disabled') === 'true') event.preventDefault()
  emit('click', event as MouseEvent)
}
</script>

<template>
  <a
    v-if="href"
    class="f-button f-button--link"
    :class="[
      'f-button--' + (appearance || 'secondary'),
      'f-button--size-' + (size || 'medium'),
      'f-button--shape-' + (shape || 'rounded'),
      { 'f-button--block': block, 'f-button--icon': iconOnly, 'is-disabled': disabled },
    ]"
    :href="href"
    :target="target"
    :rel="target === '_blank' ? rel : undefined"
    :aria-label="ariaLabel"
    :aria-disabled="disabled || undefined"
    @click="onAnchorClick"
  >
    <span class="f-button__slot">
      <span v-if="loading" class="f-button__spinner" aria-hidden="true" />
      <slot v-else name="start" />
    </span>
    <span class="f-button__label"><slot /></span>
    <span class="f-button__slot"><slot name="end" /></span>
  </a>

  <fluent-button
    v-else
    class="f-button"
    :class="{
      'f-button--block': block,
      'f-button--icon': iconOnly,
      'f-button--circular': shape === 'circular',
    }"
    :appearance="appearance"
    :size="size"
    :shape="shape === 'circular' ? 'circular' : undefined"
    :type="type"
    :disabled="disabled || loading || undefined"
    :icon-only="iconOnly || undefined"
    :aria-label="ariaLabel"
    @click="onClick"
  >
    <span slot="start" class="f-button__slot">
      <span v-if="loading" class="f-button__spinner" aria-hidden="true" />
      <slot v-else name="start" />
    </span>
    <slot />
    <span slot="end" class="f-button__slot"><slot name="end" /></span>
  </fluent-button>
</template>

<style scoped>
.f-button { max-width: 100%; }
.f-button__slot { display: inline-flex; align-items: center; }
.f-button__label { display: inline-flex; align-items: center; min-width: 0; }
.f-button__spinner {
  width: 14px; height: 14px;
  border: 2px solid color-mix(in srgb, currentColor 26%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: f-button-spin .8s linear infinite;
}
@keyframes f-button-spin { to { transform: rotate(360deg); } }

/* Links use the same Fluent 2 visual language as fluent-button. */
.f-button--link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--colorNeutralStroke1);
  border-bottom-color: var(--colorNeutralStrokeAccessible);
  border-radius: var(--borderRadiusMedium);
  background: var(--colorNeutralBackground1);
  color: var(--colorNeutralForeground1);
  font-family: inherit;
  font-size: var(--fontSizeBase300);
  font-weight: 600;
  line-height: 1.4;
  text-decoration: none;
  white-space: nowrap;
  vertical-align: middle;
  transition: background var(--app-transition), border-color var(--app-transition), color var(--app-transition);
}
.f-button--link:hover {
  background: var(--colorNeutralBackground1Hover);
  border-color: var(--colorNeutralStroke1Hover);
  color: var(--colorNeutralForeground1);
  text-decoration: none;
}
.f-button--link:active { background: var(--colorNeutralBackground1Pressed); }
.f-button--link.f-button--primary {
  background: var(--colorBrandBackground);
  border-color: transparent;
  color: var(--colorNeutralForegroundOnBrand);
}
.f-button--link.f-button--primary:hover { background: var(--colorBrandBackgroundHover); color: var(--colorNeutralForegroundOnBrand); }
.f-button--link.f-button--outline {
  background: transparent;
  border-color: var(--colorNeutralStroke1);
}
.f-button--link.f-button--subtle,
.f-button--link.f-button--transparent {
  background: transparent;
  border-color: transparent;
}
.f-button--link.f-button--subtle:hover,
.f-button--link.f-button--transparent:hover { background: var(--colorNeutralBackground1Hover); }
.f-button--link.f-button--size-small { min-height: 24px; padding: 0 10px; font-size: var(--fontSizeBase200); }
.f-button--link.f-button--size-large { min-height: 40px; padding: 0 16px; font-size: var(--fontSizeBase400); }
.f-button--link.f-button--shape-circular { border-radius: var(--borderRadiusCircular); }
.f-button--link.f-button--shape-square { border-radius: var(--borderRadiusNone); }
.f-button--link.f-button--icon { width: 32px; padding: 0; }
.f-button--link.f-button--icon.f-button--size-small { width: 24px; }
.f-button--link.f-button--icon.f-button--size-large { width: 40px; }
.f-button--link.f-button--block { display: flex; width: 100%; }
.f-button--link.is-disabled { opacity: .5; pointer-events: none; }
.f-button--block { display: flex; width: 100%; }
.f-button--block::part(button) { width: 100%; justify-content: center; }
.f-button--icon { vertical-align: middle; }
</style>
