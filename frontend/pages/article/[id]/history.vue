<script setup lang="ts">
// 历史版本已整合到文档左栏，保留旧地址的访问兼容。
const route = useRoute()
await navigateTo({ path: `/article/${route.params.id}`, query: route.query }, { replace: true, redirectCode: 302 })
</script>

<template>
  <span />
</template>
