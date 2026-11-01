<script setup lang="ts">
import {
  Activity, ArrowDown, ChartNoAxesColumn, Check, Copy, ExternalLink, FileText,
  History, RefreshCw, Trophy, UserPlus, UserRoundCheck,
} from 'lucide-vue-next'

defineProps<{
  mode: 'toolbar' | 'tabs' | 'filters' | 'follow' | 'card' | 'more' | 'copy' | 'retry'
  uid?: string; state?: string; message?: string; updatedAt?: string; activeTab?: string
  tabs?: { key: string; label: string }[]; includeFeed?: boolean; includeDiscussion?: boolean
  pending?: boolean; following?: boolean; showProfileActions?: boolean; copied?: boolean; disabled?: boolean
}>()
const emit = defineEmits<{ update: []; tab: [tab: string]; feed: [value: boolean]; discussion: [value: boolean]; action: []; follow: []; card: [] }>()
const tabIcons: Record<string, any> = { activity: Activity, intro: FileText, prizes: Trophy, names: History }
</script>

<template>
  <div class="user-controls">
    <template v-if="mode === 'toolbar'">
      <div class="cluster" style="justify-content: space-between; gap: 8px; flex-wrap: wrap">
        <span class="meta-item muted">{{ updatedAt ? '上次更新：' + updatedAt : '' }}</span>
        <div class="cluster">
          <template v-if="showProfileActions">
            <FButton :appearance="following ? 'outline' : 'primary'" size="small" :loading="pending" @click="emit('follow')">
              <template #start><component :is="following ? UserRoundCheck : UserPlus" :size="14" aria-hidden="true" /></template>
              {{ following ? '取消关注' : '关注' }}
            </FButton>
            <FButton appearance="outline" size="small" :href="'/user/' + uid + '/card'">
              <template #start><ChartNoAxesColumn :size="14" aria-hidden="true" /></template>图卡
            </FButton>
          </template>
          <FButton appearance="outline" size="small" @click="navigateTo('https://www.luogu.com.cn/user/' + uid, { external: true })">
            <template #start><ExternalLink :size="14" aria-hidden="true" /></template>源站
          </FButton>
          <ArchiveUpdateButton size="small" :state="state || 'idle'" :message="message" @update="emit('update')" />
        </div>
      </div>
    </template>

    <FTabList
      v-else-if="mode === 'tabs'"
      :model-value="activeTab || 'activity'"
      :tabs="(tabs || []).map(tab => ({ id: tab.key, label: tab.label, icon: tabIcons[tab.key] }))"
      aria-label="用户档案栏目"
      @update:model-value="emit('tab', $event)"
    />

    <div v-else-if="mode === 'filters'" class="cluster">
      <FSwitch :model-value="includeFeed" label="显示犇犇" @update:model-value="emit('feed', $event)" />
      <FSwitch :model-value="includeDiscussion" label="显示讨论" @update:model-value="emit('discussion', $event)" />
    </div>

    <FButton v-else-if="mode === 'card'" appearance="outline" size="small" :href="'/user/' + uid + '/card'">
      <template #start><ChartNoAxesColumn :size="14" aria-hidden="true" /></template>图卡
    </FButton>

    <FButton v-else-if="mode === 'retry'" appearance="outline" size="small" :disabled="pending" @click="emit('action')">
      <template #start><RefreshCw :size="14" aria-hidden="true" /></template>重试
    </FButton>

    <FButton v-else-if="mode === 'follow'" :appearance="following ? 'outline' : 'primary'" size="small" :loading="pending" @click="emit('action')">
      <template #start><component :is="following ? UserRoundCheck : UserPlus" :size="14" aria-hidden="true" /></template>
      {{ following ? '取消关注' : '关注' }}
    </FButton>

    <FButton v-else-if="mode === 'copy'" appearance="outline" size="small" :disabled="disabled" @click="emit('action')">
      <template #start><component :is="copied ? Check : Copy" :size="14" aria-hidden="true" /></template>
      {{ copied ? '已复制' : '复制原文' }}
    </FButton>

    <FButton v-else appearance="outline" size="small" :loading="pending" @click="emit('action')">
      <template #start><ArrowDown v-if="!pending" :size="14" aria-hidden="true" /></template>
      {{ pending ? '加载中…' : '加载更多' }}
    </FButton>
  </div>
</template>
