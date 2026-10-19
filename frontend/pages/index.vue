<script setup lang="ts">
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clipboard,
  FileText,
  Gavel,
  Megaphone,
  MessagesSquare,
  User,
} from '@lucide/vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

definePageMeta({ layout: 'default' })

type JumpType = 'article' | 'paste' | 'discuss' | 'user'
type Announcement = {
  id: number
  title: string
  summary: string
  content: string
  published_at: string
}

const inputId = ref('')
const selectedType = ref<JumpType>('article')
const showAllAnnouncements = ref(false)
const expandedAnnouncementId = ref<number | null>(null)
const api = useApi()
const runtimeConfig = useRuntimeConfig()

const { data: announcementData } = await useAsyncData<Announcement[]>(
  'home-announcements',
  async () => {
    try {
      return await api<Announcement[]>('/site/announcements', {
        query: { limit: 10 },
      })
    } catch {
      return []
    }
  },
)

const announcements = computed(() => announcementData.value || [])

const visibleAnnouncements = computed(() => (
  showAllAnnouncements.value ? announcements.value : announcements.value.slice(0, 1)
))

const jumpTypes: Array<{
  key: JumpType
  label: string
  placeholder: string
  icon: typeof BookOpen
}> = [
  { key: 'article', label: '文章', placeholder: '例如 abcdef12', icon: FileText },
  { key: 'paste', label: '剪贴板', placeholder: '例如 xy123abc', icon: Clipboard },
  { key: 'discuss', label: '讨论', placeholder: '例如 1337298', icon: MessagesSquare },
  { key: 'user', label: '用户', placeholder: '例如 1', icon: User },
]

const allPrimaryLinks = [
  { to: '/feed', title: '伪全网犇', meta: '“洛谷微博”', extendedArchiveModule: true, icon: MessagesSquare },
  { to: '/judgement', title: '陶片放逐', meta: '封禁公示归档', icon: Gavel },
  { to: '/problem/list', title: '题目库', meta: '题解开放状态', extendedArchiveModule: true, icon: BookOpen },
]

const primaryLinks = computed(() => allPrimaryLinks.filter(
  link => !link.extendedArchiveModule || runtimeConfig.public.extendedArchiveModulesEnabled,
))

const activeType = computed(() => jumpTypes.find(item => item.key === selectedType.value)!)

onMounted(() => {
  const saved = localStorage.getItem('quick-jump-type') as JumpType | null
  if (saved && jumpTypes.some(item => item.key === saved)) {
    selectedType.value = saved
  }
})

function setType(t: JumpType) {
  selectedType.value = t
  if (process.client) localStorage.setItem('quick-jump-type', t)
}

function go(type?: JumpType) {
  const targetType = type || selectedType.value
  const value = inputId.value.trim()
  if (!value) return
  setType(targetType)
  navigateTo(`/${targetType}/${encodeURIComponent(value)}`)
}

function toggleAnnouncement(id: number) {
  expandedAnnouncementId.value = expandedAnnouncementId.value === id ? null : id
}

function announcementDate(value: string) {
  return value.slice(0, 10)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <section class="pt-2 sm:pt-6">
      <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        洛谷档案馆
      </h1>
      <p class="mt-2 text-sm text-muted-foreground sm:text-base">
        第三方存档：保存文章、剪贴板、讨论、犇犇、陶片放逐和题目信息。
      </p>
    </section>

    <Card v-if="announcements.length" class="gap-0 overflow-hidden py-0">
      <div class="flex items-center gap-2.5 border-b border-border px-5 py-3">
        <Megaphone class="size-4 shrink-0 text-muted-foreground" />
        <span class="text-sm font-medium text-foreground">站点公告</span>
        <span class="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {{ announcements.length }}
        </span>
        <Button
          variant="ghost"
          size="sm"
          class="-mr-2 ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground"
          :aria-expanded="showAllAnnouncements"
          @click="showAllAnnouncements = !showAllAnnouncements"
        >
          {{ showAllAnnouncements ? '收起' : '全部' }}
          <ChevronDown
            class="size-3.5 transition-transform duration-200"
            :class="showAllAnnouncements ? 'rotate-180' : ''"
          />
        </Button>
      </div>

      <div class="divide-y divide-border">
        <Collapsible
          v-for="(announcement, index) in visibleAnnouncements"
          :key="announcement.id"
          :open="expandedAnnouncementId === announcement.id"
          @update:open="toggleAnnouncement(announcement.id)"
        >
          <article class="px-5 py-3.5">
            <CollapsibleTrigger as-child>
              <button
                type="button"
                class="flex w-full items-start gap-3 text-left"
              >
                <span
                  class="mt-1.5 size-1.5 shrink-0 rounded-full"
                  :class="index === 0 ? 'bg-primary' : 'bg-border'"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-foreground">
                    {{ announcement.title }}
                  </span>
                  <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                    {{ announcement.summary }}
                  </span>
                </span>
                <time class="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {{ announcementDate(announcement.published_at) }}
                </time>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p class="mt-3 whitespace-pre-wrap rounded-md bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                {{ announcement.content }}
              </p>
            </CollapsibleContent>
          </article>
        </Collapsible>
      </div>
    </Card>

    <Card class="gap-0 py-0">
      <CardContent class="p-5 sm:p-7">
        <h2 class="text-lg font-semibold text-foreground sm:text-xl">
          快速跳转
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          输入原站 ID，直接打开本站收录页；未收录时会触发后台抓取。
        </p>

        <Tabs :model-value="selectedType" class="mt-5" @update:model-value="setType($event as JumpType)">
          <TabsList class="h-9 flex-wrap">
            <TabsTrigger
              v-for="item in jumpTypes"
              :key="item.key"
              :value="item.key"
              class="flex-none gap-1.5"
            >
              <component :is="item.icon" class="size-4" />
              {{ item.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form class="mt-4 flex flex-col gap-2 sm:flex-row" @submit.prevent="go()">
          <Input
            v-model="inputId"
            :placeholder="activeType.placeholder"
            autocomplete="off"
            spellcheck="false"
            class="h-11 text-base sm:flex-1"
          />
          <Button type="submit" class="h-11 gap-1.5 px-5" :disabled="!inputId.trim()">
            打开
            <ArrowRight class="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>

    <div
      v-if="primaryLinks.length"
      class="grid gap-3"
      :class="primaryLinks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'"
    >
      <NuxtLink
        v-for="link in primaryLinks"
        :key="link.to"
        :to="link.to"
        class="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
      >
        <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-primary">
          <component :is="link.icon" class="size-5" />
        </span>
        <span class="min-w-0">
          <strong class="block truncate text-sm font-medium text-foreground">{{ link.title }}</strong>
          <small class="block truncate text-xs text-muted-foreground">{{ link.meta }}</small>
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
