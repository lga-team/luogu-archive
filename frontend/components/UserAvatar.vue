<!--
  统一头像：图片、首字母回退、底色取自洛谷用户名颜色。

  props:
    user  { name, color, avatar }
    size  'xs' | 'sm' | 'md' | 'lg' | 'xl'
-->
<script setup lang="ts">
interface LuoguUserBrief {
  name: string
  color: string
  avatar: string | null
}

const props = withDefaults(defineProps<{
  user: LuoguUserBrief | null | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}>(), {
  size: 'md',
})

const SIZES = {
  xs: { box: 'size-4', text: 'text-[8px]' },
  sm: { box: 'size-5', text: 'text-[9px]' },
  md: { box: 'size-6', text: 'text-[10px]' },
  lg: { box: 'size-8', text: 'text-xs' },
  xl: { box: 'size-10', text: 'text-sm' },
  '2xl': { box: 'size-20', text: 'text-2xl' },
} as const

const COLORS: Record<string, string> = {
  Gray: 'var(--lg-gray)',
  Blue: 'var(--lg-blue)',
  Green: 'var(--success)',
  Orange: 'var(--warning)',
  Yellow: 'var(--warning)',
  Red: 'var(--destructive)',
  Purple: 'var(--lg-purple)',
  Cyan: 'var(--info)',
  Black: 'var(--lg-black)',
  Cheater: 'var(--lg-cheater-tag)',
}

const sizeClass = computed(() => SIZES[props.size])
const background = computed(() => COLORS[props.user?.color || ''] || 'var(--lg-gray)')
const foreground = computed(() => (props.user?.color === 'Yellow' ? '#333' : '#fff'))
const initial = computed(() => (props.user?.name || '?').charAt(0).toUpperCase())

const failed = ref(false)
watch(() => props.user?.avatar, () => { failed.value = false })

// 无头像或加载失败才显示回退；加载中保持透明，避免闪现字母
const showFallback = computed(() => !props.user?.avatar || failed.value)
</script>

<template>
  <Avatar :class="sizeClass.box">
    <AvatarImage
      v-if="user?.avatar"
      :src="user.avatar"
      :alt="user.name"
      loading="lazy"
      @error="failed = true"
    />
    <AvatarFallback
      class="font-semibold"
      :class="sizeClass.text"
      :style="showFallback
        ? { backgroundColor: background, color: foreground }
        : { backgroundColor: 'transparent', color: 'transparent' }"
    >
      {{ initial }}
    </AvatarFallback>
  </Avatar>
</template>
