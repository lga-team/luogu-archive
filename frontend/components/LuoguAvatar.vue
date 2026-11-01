<script setup lang="ts">
interface AvatarUser {
  uid?: number | null
  name?: string | null
  avatar?: string | null
}
const props = withDefaults(defineProps<{
  user?: AvatarUser | null
  size?: number
  hidden?: boolean
  alt?: string
}>(), { size: 32, hidden: false })

const failed = ref(false)
watch(() => props.user?.avatar, () => { failed.value = false })
watch(() => props.user?.uid, () => { failed.value = false })

const src = computed(() => {
  if (props.hidden) return ''
  const raw = String(props.user?.avatar || '').trim()
  if (raw) {
    if (raw.startsWith('//')) return 'https:' + raw
    if (raw.startsWith('http://cdn.luogu.com.cn/')) return raw.replace('http://', 'https://')
    return raw
  }
  // 部分接口不返回 avatar，但洛谷头像地址可由 UID 直接推导。
  return props.user?.uid ? `https://cdn.luogu.com.cn/upload/usericon/${props.user.uid}.png` : ''
})
const fallbackName = computed(() => props.user?.name || (props.user?.uid ? `UID ${props.user.uid}` : '洛谷用户'))
const initials = computed(() => (props.user?.name || '?').trim().slice(0, 1).toUpperCase())
</script>

<template>
  <img
    v-if="src && !failed"
    class="luogu-avatar"
    :src="src"
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px' }"
    :alt="alt || ''"
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="failed = true"
  >
  <FAvatar v-else :name="fallbackName" :initials="initials" :size="size" />
</template>

<style scoped>
.luogu-avatar {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--colorNeutralBackground3);
  display: inline-block;
}
</style>
