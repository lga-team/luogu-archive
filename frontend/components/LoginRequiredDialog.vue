<script setup lang="ts">
import { ArrowLeft, LogIn } from 'lucide-vue-next'
import { Button, Dialog } from './ui'
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; login: [] }>()
</script>
<template>
  <Dialog :open="open" title="请先登录" description="登录后即可关注该用户。是否前往登录？"
    content-class="login-required-dialog" overlay-class="login-required-overlay" @update:open="!$event && emit('close')">
    <template #footer><Button variant="outline" size="sm" @click="emit('close')"><ArrowLeft :size="14" aria-hidden="true" />返回</Button><Button size="sm" @click="emit('login')"><LogIn :size="14" aria-hidden="true" />登录</Button></template>
  </Dialog>
</template>
<style src="~/assets/css/login-required-dialog.css" />
