<script setup lang="ts">
import { settingsAuthRoute } from '~/utils/settingsAuth'

definePageMeta({
  middleware: (to) => navigateTo(settingsAuthRoute('register', to.query.redirect), { replace: true }),
})
</script>

<template><div /></template>
