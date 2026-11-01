<script setup lang="ts">
import { Mail } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const email = ref('')
const message = ref('')

onMounted(async () => {
  if (!admin.isLoggedIn) return navigateTo('/admin/login')
  const data = await api<any>('/admin/notification-email')
  email.value = data.email || ''
})
async function submit() {
  const data = await api<any>('/admin/notification-email', { method: 'POST', body: { email: email.value } })
  message.value = data.message
}
</script>

<template>
  <div class="page page--narrow">
    <PageHeader title="通知邮箱" description="保存后，该邮箱会收到插件推荐、删除和举报通知。邮件发送失败不会回滚申请。" eyebrow="Notifications">
      <template #icon><Mail :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
    </PageHeader>
    <form class="card card__body form" @submit.prevent="submit">
      <div class="stack stack--xs">
        <label for="admin-notify-email" class="field-label">通知邮箱</label>
        <FInput id="admin-notify-email" v-model.trim="email" type="email" required placeholder="admin@example.com" />
      </div>
      <div class="form-actions">
        <FButton type="submit" appearance="primary">保存</FButton>
      </div>
      <div v-if="message" class="notice notice--brand">{{ message }}</div>
    </form>
  </div>
</template>
