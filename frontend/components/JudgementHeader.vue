<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'
import { Button } from './ui'
defineProps<{ state: string; message: string; updatedAt: string }>()
const emit = defineEmits<{ update: [] }>()
</script>
<template>
  <div class="archive-ui judgement-header-stack">
    <ArchivePageHeader title="陶片放逐" description="洛谷社区用户权限变更记录" icon="gavel" />
    <div class="archive-card judgement-toolbar"><div class="archive-card-footer judgement-heading-footer">
      <span class="judgement-heading-updated">{{ updatedAt ? '上次更新：' + updatedAt : '' }}</span>
      <div class="judgement-heading-actions">
        <Button variant="outline" size="sm" as-child><a href="https://www.luogu.com.cn/judgement" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" aria-hidden="true" />查看源站</a></Button>
        <ArchiveUpdateButton :state="state" :message="message" @update="emit('update')" />
      </div>
      <p v-if="state === 'captcha' && message" class="judgement-heading-message" role="status">{{ message }}</p>
    </div></div>
  </div>
</template>
