<!--
  内容未收录/加载失败的统一空态：图标 + 标题 + 说明 + 动作行。
  retry 事件触发页面自身的 refresh（404 时后端已触发爬取，重查往往就有数据）；
  额外动作（如返回列表）放默认插槽。
-->
<script setup lang="ts">
import { Inbox, RotateCw } from 'lucide-vue-next'

defineProps<{
  title: string
  description?: string | null
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="mx-auto max-w-sm py-16 text-center">
    <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
      <Inbox class="size-6 text-muted-foreground" />
    </div>
    <h2 class="mt-4 text-base font-semibold text-foreground">{{ title }}</h2>
    <p v-if="description" class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
      {{ description }}
    </p>
    <div class="mt-5 flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" @click="emit('retry')">
        <RotateCw class="size-3.5" />
        重新加载
      </Button>
      <slot />
    </div>
  </div>
</template>
