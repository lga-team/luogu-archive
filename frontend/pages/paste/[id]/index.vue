<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
</script>

<template>
  <ArchiveDocumentPage content-type="paste" :content-id="id" />
</template>
