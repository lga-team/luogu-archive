<!--
  关注按钮。挂在用户主页上。
  - 未登录：点击跳登录
  - 已关注：显示"已关注"，点击取消
  - 未关注：显示"关注"
-->
<script setup lang="ts">
import { Check, Loader2, UserPlus } from '@lucide/vue'
import { toast } from 'vue-sonner'

const props = defineProps<{ uid: number }>()

const auth = useAuthStore()
const api = useApi()
const following = ref(false)
const loading = ref(false)

async function refresh() {
  if (!auth.isLoggedIn) return
  try {
    const list = await api<Array<{ uid: number }>>('/follows')
    following.value = list.some(r => r.uid === props.uid)
  } catch {}
}

onMounted(refresh)
watch(() => auth.isLoggedIn, refresh)

async function toggle() {
  if (!auth.isLoggedIn) {
    navigateTo('/login')
    return
  }
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
    toast.error(e?.data?.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Button
    type="button"
    :variant="following ? 'outline' : 'default'"
    size="sm"
    :disabled="loading"
    @click="toggle"
  >
    <Loader2 v-if="loading" class="size-3.5 animate-spin" />
    <Check v-else-if="following" class="size-3.5" />
    <UserPlus v-else class="size-3.5" />
    {{ !auth.isLoggedIn ? '关注' : following ? '已关注' : '关注' }}
  </Button>
</template>
