<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
</script>

<template>
  <ArchiveDocumentPage content-type="article" :content-id="id" />
</template>
