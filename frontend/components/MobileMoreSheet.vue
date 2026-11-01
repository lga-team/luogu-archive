<script setup lang="ts">
import { X } from 'lucide-vue-next'

interface NavItem { to: string; label: string; icon: any }

const props = defineProps<{ open: boolean; items: NavItem[] }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const route = useRoute()
const closeButton = ref<HTMLButtonElement | null>(null)
let previousOverflow = ''

function close() {
  emit('update:open', false)
}
function isActive(to: string) {
  const path = to.split('?')[0]
  return path === '/' ? route.path === '/' : route.path === path || route.path.startsWith(path + '/')
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) close()
}
function lockBody(open: boolean) {
  if (!import.meta.client) return
  if (open) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousOverflow
  }
}
watch(() => route.path, () => { if (props.open) close() })
watch(() => props.open, async (open) => {
  lockBody(open)
  if (open) {
    await nextTick()
    closeButton.value?.focus()
  }
})
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  lockBody(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="open" class="more-sheet__backdrop" @click="close" />
    </Transition>
    <Transition name="sheet-up">
      <section
        v-if="open"
        class="more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="更多导航"
      >
        <span class="more-sheet__handle" aria-hidden="true" />
        <header class="more-sheet__head">
          <div>
            <h2 class="more-sheet__title">更多</h2>
            <p class="more-sheet__hint">全部导航与设置</p>
          </div>
          <button ref="closeButton" type="button" class="more-sheet__close" aria-label="关闭" @click="close">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>
        <nav class="more-sheet__grid">
          <NuxtLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            class="more-sheet__item"
            :class="{ 'is-active': isActive(item.to) }"
            @click="close"
          >
            <component :is="item.icon" :size="20" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.more-sheet__backdrop {
  position: fixed; inset: 0; z-index: 110;
  background: rgb(0 0 0 / 42%);
  backdrop-filter: blur(2px);
}
.more-sheet {
  position: fixed; z-index: 111; left: 0; right: 0; bottom: 0;
  max-height: 80dvh; overflow-y: auto;
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--colorNeutralBackground1);
  box-shadow: 0 -12px 40px rgb(0 0 0 / 22%);
  transform-origin: bottom center;
}
.more-sheet__handle {
  display: block; width: 38px; height: 4px; margin: 2px auto 10px;
  border-radius: 999px; background: var(--colorNeutralStroke1);
}
.more-sheet__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 2px 0 16px; }
.more-sheet__title { margin: 0; font-size: 20px; line-height: 1.3; color: var(--colorNeutralForeground1); }
.more-sheet__hint { margin: 3px 0 0; font-size: 12px; color: var(--colorNeutralForeground3); }
.more-sheet__close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex-shrink: 0;
  border: 1px solid var(--colorNeutralStroke2); border-radius: 50%;
  background: var(--colorNeutralBackground2); color: var(--colorNeutralForeground2);
  cursor: pointer;
}
.more-sheet__close:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorNeutralForeground1); }
.more-sheet__close:focus-visible { outline: 2px solid var(--colorBrandStroke1); outline-offset: 2px; }
.more-sheet__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.more-sheet__item {
  display: flex; align-items: center; gap: 10px;
  min-height: 48px; padding: 0 13px;
  border: 1px solid var(--colorNeutralStroke2); border-radius: 10px;
  background: var(--colorNeutralBackground2);
  color: var(--colorNeutralForeground2);
  font-size: 14px; font-weight: 500; text-decoration: none;
}
.more-sheet__item:hover { background: var(--colorNeutralBackground1Hover); color: var(--colorNeutralForeground1); text-decoration: none; }
.more-sheet__item.is-active { background: var(--colorBrandBackground2); border-color: var(--colorBrandStroke2); color: var(--colorBrandForeground1); font-weight: 600; }
.more-sheet__item svg { flex-shrink: 0; }
.more-sheet__item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity 180ms ease; }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
.sheet-up-enter-active { transition: transform 260ms cubic-bezier(.2, .8, .2, 1), opacity 180ms ease; }
.sheet-up-leave-active { transition: transform 200ms cubic-bezier(.4, 0, 1, 1), opacity 140ms ease; }
.sheet-up-enter-from, .sheet-up-leave-to { opacity: 0; transform: translateY(100%); }

@media (min-width: 901px) {
  .more-sheet, .more-sheet__backdrop { display: none; }
}
</style>
