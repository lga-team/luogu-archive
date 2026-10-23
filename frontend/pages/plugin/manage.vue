<script setup lang="ts">
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const api = useApi()
const loading = ref(true)
const errorText = ref('')
const data = ref<{ plugins: any[]; applications: any[] }>({ plugins: [], applications: [] })

const typeNames: Record<string, string> = {
  publish: '首次发布', update: '版本更新', recommend: '推荐申请', delete: '删除申请',
}
const statusNames: Record<string, string> = {
  pending: '待审核', approved: '已通过', rejected: '已拒绝', cancelled: '已撤销',
}
const STATUS_BADGE: Record<string, string> = {
  pending: 'border-transparent bg-[var(--warning)]/20 text-[#8a6d00] dark:text-[var(--warning)]',
  approved: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'border-transparent bg-destructive/10 text-destructive',
  cancelled: '',
}

// 撤销确认与推荐/删除原因都走 Dialog，替代原生 confirm/prompt
const cancelTarget = ref<number | null>(null)
const cancelOpen = ref(false)
const cancelling = ref(false)

const reasonOpen = ref(false)
const reasonType = ref<'recommend' | 'delete'>('recommend')
const reasonTarget = ref('')
const reasonText = ref('')
const reasonSubmitting = ref(false)
const reasonTitle = computed(() =>
  reasonType.value === 'recommend' ? '申请推荐' : '申请删除',
)

async function load() {
  loading.value = true
  try {
    data.value = await api('/plugins/manage')
  } catch (error: any) {
    errorText.value = error?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function askCancel(applicationId: number) {
  cancelTarget.value = applicationId
  cancelOpen.value = true
}

async function confirmCancel() {
  if (cancelTarget.value === null || cancelling.value) return
  cancelling.value = true
  try {
    await api(`/plugins/applications/${cancelTarget.value}`, { method: 'DELETE' })
    cancelOpen.value = false
    toast.success('申请已撤销')
    await load()
  } catch (error: any) {
    toast.error(error?.data?.message || '撤销失败')
  } finally {
    cancelling.value = false
  }
}

function openReason(articleId: string, type: 'recommend' | 'delete') {
  reasonTarget.value = articleId
  reasonType.value = type
  reasonText.value = ''
  reasonOpen.value = true
}

async function submitReason() {
  const reason = reasonText.value.trim()
  if (reason.length < 5) {
    toast.error('请填写至少 5 个字的说明')
    return
  }
  reasonSubmitting.value = true
  try {
    await api(`/plugins/${reasonTarget.value}/applications/${reasonType.value}`, {
      method: 'POST',
      body: { reason },
    })
    reasonOpen.value = false
    toast.success(reasonType.value === 'recommend' ? '推荐申请已提交' : '删除申请已提交')
    await load()
  } catch (error: any) {
    toast.error(error?.data?.message || '提交失败')
  } finally {
    reasonSubmitting.value = false
  }
}

onMounted(async () => {
  if (!auth.initialized) await auth.tryRefresh()
  if (!auth.isLoggedIn) {
    await navigateTo('/login?redirect=/plugin/manage')
    return
  }
  await load()
})

useHead({ title: '我的插件 - 洛谷档案馆' })
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">我的插件</h1>
        <p class="mt-1 text-sm text-muted-foreground">查看公开插件、待审核版本和历史申请。</p>
      </div>
      <Button size="sm" as-child>
        <NuxtLink to="/plugin/submit">提交新插件</NuxtLink>
      </Button>
    </header>

    <div v-if="loading" class="space-y-2.5">
      <Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" />
    </div>

    <Card v-else-if="errorText" class="mx-auto max-w-md gap-0 py-12 text-center">
      <p class="text-sm text-destructive">{{ errorText }}</p>
    </Card>

    <template v-else>
      <section>
        <h2 class="mb-3 text-lg font-semibold text-foreground">已发布插件</h2>
        <div v-if="data.plugins.length" class="space-y-2.5">
          <article
            v-for="plugin in data.plugins"
            :key="plugin.id"
            class="group rounded-xl border border-border bg-card p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div class="min-w-0">
                <NuxtLink
                  :to="`/plugin/${plugin.article_id}`"
                  class="block truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground transition-colors hover:text-primary"
                >
                  {{ plugin.name }}
                </NuxtLink>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  文章 <span class="font-mono">{{ plugin.article_id }}</span> ·
                  {{ plugin.is_listed ? '公开展示' : '已下架' }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" as-child>
                  <NuxtLink :to="`/plugin/submit?article_id=${plugin.article_id}`">提交更新</NuxtLink>
                </Button>
                <Button
                  v-if="!plugin.is_recommended"
                  variant="outline"
                  size="sm"
                  @click="openReason(plugin.article_id, 'recommend')"
                >
                  申请推荐
                </Button>
                <Button variant="outline" size="sm" class="text-destructive" @click="openReason(plugin.article_id, 'delete')">
                  申请删除
                </Button>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="rounded-xl border border-dashed border-border py-12 text-center">
          <p class="text-sm text-muted-foreground">还没有通过审核的插件</p>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold text-foreground">申请记录</h2>
        <div v-if="data.applications.length" class="space-y-2.5">
          <article
            v-for="application in data.applications"
            :key="application.id"
            class="rounded-xl border border-border bg-card p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground">
                  {{ typeNames[application.application_type] || application.application_type }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  文章 <span class="font-mono">{{ application.article_id }}</span>
                  <template v-if="application.version"> · v{{ application.version }}</template>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="h-5 px-1.5 font-normal" :class="STATUS_BADGE[application.status]">
                  {{ statusNames[application.status] || application.status }}
                </Badge>
                <Button
                  v-if="application.status === 'pending'"
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs text-muted-foreground"
                  @click="askCancel(application.id)"
                >
                  撤销
                </Button>
              </div>
            </div>
            <p v-if="application.review_note" class="mt-2 border-t border-border pt-2 text-xs text-destructive">
              审核意见：{{ application.review_note }}
            </p>
          </article>
        </div>
        <div v-else class="rounded-xl border border-dashed border-border py-12 text-center">
          <p class="text-sm text-muted-foreground">暂无申请记录</p>
        </div>
      </section>
    </template>

    <Dialog v-model:open="cancelOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>撤销申请</DialogTitle>
          <DialogDescription>确定撤销这条待审核申请吗？</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelOpen = false">取消</Button>
          <Button variant="destructive" :disabled="cancelling" @click="confirmCancel">
            {{ cancelling ? '撤销中…' : '确认撤销' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="reasonOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ reasonTitle }}</DialogTitle>
          <DialogDescription>
            {{ reasonType === 'recommend' ? '请说明推荐理由，会展示给审核与管理组。' : '请说明删除原因，管理组审核后执行。' }}
          </DialogDescription>
        </DialogHeader>

        <form class="space-y-3" @submit.prevent="submitReason">
          <Textarea
            v-model.trim="reasonText"
            rows="4"
            required
            :placeholder="reasonType === 'recommend' ? '推荐理由（至少 5 个字）' : '删除原因（至少 5 个字）'"
          />
          <DialogFooter>
            <Button type="button" variant="outline" @click="reasonOpen = false">取消</Button>
            <Button type="submit" :disabled="reasonSubmitting">
              {{ reasonSubmitting ? '提交中…' : '提交' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
