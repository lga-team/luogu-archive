<script setup lang="ts">
const model = defineModel<string>({ required: true })
defineProps<{
  label: string
  placeholder?: string
  maxlength?: number
}>()

const mode = ref<string>('write')
const { render } = useMarkdown()
const previewHtml = computed(() => render(model.value || ''))
</script>

<template>
  <div class="space-y-2">
    <Label class="text-sm font-medium">{{ label }}</Label>
    <Tabs v-model="mode" class="gap-3">
      <TabsList class="h-8">
        <TabsTrigger value="write" class="flex-none text-xs">编辑</TabsTrigger>
        <TabsTrigger value="preview" class="flex-none text-xs">预览</TabsTrigger>
      </TabsList>

      <TabsContent value="write" class="mt-0">
        <Textarea
          v-model="model"
          :placeholder="placeholder"
          :maxlength="maxlength"
          rows="12"
          class="min-h-[220px] font-mono text-[13px] leading-relaxed"
        />
      </TabsContent>

      <TabsContent value="preview" class="mt-0">
        <div
          class="lg-content min-h-[220px] rounded-md border border-border bg-card p-3"
          v-html="previewHtml"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>
