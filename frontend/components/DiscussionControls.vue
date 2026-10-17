<script setup lang="ts">
import { Check, Copy, ExternalLink, LayoutGrid, RefreshCw } from 'lucide-vue-next'
import { Button } from './ui'
defineProps<{
  mode: 'header' | 'forums' | 'retry' | 'detail-header' | 'detail-toolbar' | 'copy'
  state?: string; message?: string; updatedAt?: string
  forums?: { name: string; slug: string; count: number }[]
  selectedForum?: string; page?: number; totalPages?: number; pending?: boolean
  title?: string; forumName?: string; discussionId?: number; copied?: boolean; copyDisabled?: boolean
}>()
const emit = defineEmits<{ update: []; forum: [slug: string]; page: [page: number]; retry: []; copy: []; back: [] }>()
</script>
<template>
  <div class="archive-ui">
    <h1 v-if="mode === 'detail-header'" class="discussion-post-title">{{ title || '讨论 #' + discussionId }}</h1>
    <div v-else-if="mode === 'header' || mode === 'detail-toolbar'" :class="mode === 'header' ? 'judgement-header-stack' : undefined">
      <ArchivePageHeader v-if="mode === 'header'" title="讨论区" description="洛谷讨论区帖子与回复" icon="discussion" />
      <div class="archive-card judgement-toolbar"><div class="archive-card-footer judgement-heading-footer" :class="{ 'discussion-detail-toolbar': mode === 'detail-toolbar' }">
        <span class="judgement-heading-updated">{{ updatedAt ? '上次更新：' + updatedAt : '' }}</span>
        <div class="judgement-heading-actions">
          <Button variant="outline" size="sm" as-child><a :href="'https://www.luogu.com.cn/discuss' + (mode === 'detail-toolbar' ? '/' + discussionId : '')" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" aria-hidden="true" />{{ mode === 'detail-toolbar' ? '查看原文' : '查看源站' }}</a></Button>
          <Button v-if="mode === 'detail-toolbar'" variant="outline" size="sm" class="discussion-copy" :disabled="copyDisabled" :aria-label="copied ? '原文已复制' : '复制 Markdown 原文'" @click="emit('copy')"><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />{{ copied ? '已复制' : '复制原文' }}</Button>
          <ArchiveUpdateButton :state="state || 'idle'" :message="message" @update="emit('update')" />
        </div>
        <p v-if="state === 'captcha' && message" class="judgement-heading-message" role="status">{{ message }}</p>
      </div></div>
    </div>
    <div v-else-if="mode === 'forums'" class="archive-card discussion-forums">
      <div class="archive-card-header discussion-forums-heading"><div class="archive-card-title">版块</div></div>
      <nav class="discussion-forum-options" aria-label="讨论版块">
        <Button variant="ghost" class="discussion-forum-option" :aria-pressed="!selectedForum" @click="emit('forum', '')"><LayoutGrid :size="14" aria-hidden="true" /><span>全部版块</span></Button>
        <Button v-for="forum in forums || []" :key="forum.slug" variant="ghost" class="discussion-forum-option" :aria-pressed="selectedForum === forum.slug" @click="emit('forum', forum.slug)"><span class="discussion-forum-dot" :data-forum="forum.slug" aria-hidden="true" /><span>{{ forum.name }}</span><span class="discussion-forum-count">{{ forum.count.toLocaleString('zh-CN') }}</span></Button>
      </nav>
    </div>
    <Button v-else-if="mode === 'retry'" variant="outline" size="sm" :disabled="pending" @click="emit('retry')"><RefreshCw :size="14" aria-hidden="true" />重试</Button>
    <Button v-else-if="mode === 'copy'" variant="outline" size="sm" class="discussion-copy" :disabled="copyDisabled" :aria-label="copied ? '原文已复制' : '复制 Markdown 原文'" @click="emit('copy')"><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />{{ copied ? '已复制' : '复制原文' }}</Button>
  </div>
</template>
<style src="~/assets/css/discussion.css" />
