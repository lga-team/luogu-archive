<script setup lang="ts">
import { Activity, FilePenLine, Gavel, Image, MailCheck, Megaphone, MessagesSquare, Puzzle, Settings, ShieldMinus, Users } from 'lucide-vue-next'
const icons = { activity: Activity, gavel: Gavel, megaphone: Megaphone, discussion: MessagesSquare, plugin: Puzzle, solution: FilePenLine, settings: Settings, follows: Users, takedown: ShieldMinus, verify: MailCheck, card: Image }
defineProps<{ title: string; description: string; icon: keyof typeof icons }>()
</script>
<template>
  <div class="archive-card judgement-heading"><div class="archive-card-header judgement-heading-main">
    <component :is="icons[icon]" class="judgement-heading-icon" :size="56" :stroke-width="1.8" aria-hidden="true" />
    <div class="judgement-heading-copy"><div class="archive-card-title"><h1>{{ title }}</h1></div><p class="archive-card-description">{{ description }}</p></div>
  </div></div>
</template>
