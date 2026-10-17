<script setup lang="ts">
import { Activity, ArrowDown, ChartNoAxesColumn, Check, Copy, ExternalLink, FileText, History, LoaderCircle, RefreshCw, Trophy, UserPlus, UserRoundCheck } from 'lucide-vue-next'
import { Button, Switch } from './ui'
defineProps<{
  mode: 'toolbar' | 'tabs' | 'filters' | 'follow' | 'card' | 'more' | 'copy' | 'retry'
  uid?: string; state?: string; message?: string; updatedAt?: string; activeTab?: string
  tabs?: { key: string; label: string }[]; includeFeed?: boolean; includeDiscussion?: boolean
  pending?: boolean; following?: boolean; showProfileActions?: boolean; copied?: boolean; disabled?: boolean
}>()
const emit = defineEmits<{ update: []; tab: [tab: string]; feed: [value: boolean]; discussion: [value: boolean]; action: []; follow: []; card: [] }>()
const tabIcons: Record<string, typeof Activity> = { activity: Activity, intro: FileText, prizes: Trophy, names: History }
</script>
<template>
  <div class="archive-ui">
    <div v-if="mode === 'toolbar'" class="archive-card judgement-toolbar user-profile-toolbar"><div class="archive-card-footer judgement-heading-footer">
      <span class="judgement-heading-updated">{{ updatedAt ? '上次更新：' + updatedAt : '' }}</span>
      <div class="judgement-heading-actions user-profile-actions" :data-full="showProfileActions ? 'true' : undefined">
        <template v-if="showProfileActions">
          <Button :variant="following ? 'outline' : 'default'" size="sm" class="user-follow-button" :data-following="following ? 'true' : 'false'" :disabled="pending" @click="emit('follow')"><component :is="pending ? LoaderCircle : following ? UserRoundCheck : UserPlus" :size="14" :class="{ 'user-control-spin': pending }" aria-hidden="true" />{{ following ? '取消' : '关注' }}</Button>
          <Button variant="outline" size="sm" as-child><NuxtLink :to="'/user/' + uid + '/card'" @click.prevent="emit('card')"><ChartNoAxesColumn :size="14" aria-hidden="true" />图卡</NuxtLink></Button>
        </template>
        <Button variant="outline" size="sm" as-child><a :href="'https://www.luogu.com.cn/user/' + uid" target="_blank" rel="noopener noreferrer"><ExternalLink :size="14" aria-hidden="true" />查看源站</a></Button>
        <ArchiveUpdateButton :state="state || 'idle'" :message="message" @update="emit('update')" />
      </div>
      <p v-if="state === 'captcha' && message" class="judgement-heading-message" role="status">{{ message }}</p>
    </div></div>
    <div v-else-if="mode === 'tabs'" class="archive-card user-section-navigation"><nav aria-label="用户档案栏目" class="user-section-tabs">
      <Button v-for="tab in tabs || []" :key="tab.key" variant="ghost" class="user-section-tab" :aria-pressed="activeTab === tab.key" @click="emit('tab', tab.key)"><component :is="tabIcons[tab.key] || FileText" :size="15" aria-hidden="true" />{{ tab.label }}</Button>
    </nav></div>
    <div v-else-if="mode === 'filters'" class="user-activity-filters">
      <label><Switch :model-value="includeFeed" aria-label="显示犇犇" @update:model-value="emit('feed', $event)" />显示犇犇</label>
      <label><Switch :model-value="includeDiscussion" aria-label="显示讨论" @update:model-value="emit('discussion', $event)" />显示讨论</label>
    </div>
    <Button v-else-if="mode === 'card'" variant="outline" size="sm" as-child><NuxtLink :to="'/user/' + uid + '/card'" @click.prevent="emit('action')"><ChartNoAxesColumn :size="14" aria-hidden="true" />图卡</NuxtLink></Button>
    <Button v-else-if="mode === 'retry'" variant="outline" size="sm" :disabled="pending" @click="emit('action')"><RefreshCw :size="14" aria-hidden="true" />重试</Button>
    <Button v-else-if="mode === 'follow'" :variant="following ? 'outline' : 'default'" size="sm" class="user-follow-button" :data-following="following ? 'true' : 'false'" :disabled="pending" @click="emit('action')"><component :is="pending ? LoaderCircle : following ? UserRoundCheck : UserPlus" :size="14" :class="{ 'user-control-spin': pending }" aria-hidden="true" />{{ following ? '取消' : '关注' }}</Button>
    <Button v-else-if="mode === 'copy'" variant="outline" size="sm" :disabled="disabled" @click="emit('action')"><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />{{ copied ? '已复制' : '复制原文' }}</Button>
    <Button v-else variant="outline" size="sm" :disabled="pending" @click="emit('action')"><component :is="pending ? LoaderCircle : ArrowDown" :size="14" :class="{ 'user-control-spin': pending }" aria-hidden="true" />{{ pending ? '加载中…' : '加载更多' }}</Button>
  </div>
</template>
<style src="~/assets/css/user.css" />
