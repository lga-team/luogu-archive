<script setup lang="ts">
import { Heart, HeartOff } from 'lucide-vue-next'

const props = defineProps<{ uid: number }>()
const auth = useAuthStore()
const api = useApi()
const following = ref(false)
const loading = ref(false)
const loginRequired = ref(false)

function login() {
  loginRequired.value = false
  void navigateTo('/login')
}

async function refresh() {
  if (!auth.isLoggedIn) return
  try {
    const list = await api<Array<{ uid: number }>>('/follows')
    following.value = list.some(r => r.uid === props.uid)
  } catch { /* 未登录或接口不可用时保持默认 */ }
}

onMounted(refresh)
watch(() => auth.isLoggedIn, () => {
  loginRequired.value = false
  following.value = false
  void refresh()
})

async function toggle() {
  if (!auth.isLoggedIn) { loginRequired.value = true; return }
  loading.value = true
  try {
    if (following.value) {
      await api(`/follows/${props.uid}`, { method: 'DELETE' })
      following.value = false
    } else {
      await api('/follows', { method: 'POST', body: { uid: props.uid } })
      following.value = true
    }
  } catch (e: any) {
    alert(e?.data?.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <slot :following="following" :loading="loading" :toggle="toggle">
    <FButton
      :appearance="following ? 'outline' : 'primary'"
      :loading="loading"
      @click="toggle"
    >
      <template #start>
        <component :is="following ? HeartOff : Heart" :size="16" aria-hidden="true" />
      </template>
      {{ !auth.isLoggedIn ? '关注（需登录）' : following ? '已关注' : '关注' }}
    </FButton>
  </slot>
  <LoginRequiredDialog :open="loginRequired" @close="loginRequired = false" @login="login" />
</template>
