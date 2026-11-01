<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

defineProps<{ open: boolean; title?: string; description?: string }>()
const emit = defineEmits<{ close: []; login: [] }>()
</script>

<template>
  <FDialog :open="open" :title="title || '需要登录'" @update:open="emit('close')">
    <p class="muted" style="font-size: 14px; line-height: 1.7">
      {{ description || '登录后即可使用这个功能。登录状态仅保存在你的浏览器中。' }}
    </p>
    <template #actions>
      <FButton appearance="outline" @click="emit('close')">取消</FButton>
      <FButton appearance="primary" @click="emit('login')">
        <template #start><LogIn :size="16" aria-hidden="true" /></template>
        去登录
      </FButton>
    </template>
  </FDialog>
</template>
