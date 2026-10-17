<script setup lang="ts">
import { Activity, Gavel, Megaphone, MessagesSquare } from 'lucide-vue-next'
defineProps<{ title: string; description: string; icon: 'activity' | 'gavel' | 'megaphone' | 'discussion' }>()
const icons = { activity: Activity, gavel: Gavel, megaphone: Megaphone, discussion: MessagesSquare }
</script>
<template>
  <div class="archive-card judgement-heading"><div class="archive-card-header judgement-heading-main">
    <component :is="icons[icon]" class="judgement-heading-icon" :size="56" :stroke-width="1.8" aria-hidden="true" />
    <div class="judgement-heading-copy"><div class="archive-card-title"><h1>{{ title }}</h1></div><p class="archive-card-description">{{ description }}</p></div>
  </div></div>
</template>
