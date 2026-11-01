<script setup lang="ts">
import { Trophy } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
const admin = useAdminStore()
const api = useAdminApi()
const contestId = ref<number | null>(null)
const message = ref('')
const busy = ref('')

interface AdminContest {
  id: number; name: string; start_time: string; end_time: string; status: string
  rated: boolean; participant_count: number; error_message: string | null
}
interface AdminContestResponse { items: AdminContest[]; total: number }

const { data, refresh } = useLazyAsyncData('admin-contests', () => api<AdminContestResponse>('/admin/contests'), { server: false })
const statusText: Record<string, string> = {
  discovered: '等待结束', queued: '已排队', crawling: '抓取榜单', refreshing_users: '刷新用户',
  predicted: '预测完成', official: '正式结果', failed: '失败',
}
const statusClass = (status: string) => status === 'official' ? 'tag--success' : status === 'failed' ? 'tag--danger' : 'tag--info'

async function runAction(key: string, path: string, options: any = {}) {
  if (busy.value) return
  busy.value = key
  message.value = '处理中…'
  try {
    const response = await api<{ message: string }>(path, { method: 'POST', ...options })
    message.value = response.message
    setTimeout(() => refresh(), 1000)
  } catch (error: any) {
    message.value = error?.data?.message || '操作失败'
  } finally {
    busy.value = ''
  }
}
function archiveById() {
  if (!contestId.value) return
  runAction('archive-new', '/admin/contests/archive', { body: { contest_id: contestId.value } })
}
onMounted(() => { if (!admin.isLoggedIn) navigateTo('/admin/login') })
</script>

<template>
  <div class="page">
    <PageHeader title="比赛归档" description="自动任务每小时扫描比赛列表第一页，比赛结束后只归档一次榜单。" eyebrow="Contests">
      <template #icon><Trophy :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton appearance="outline" :disabled="!!busy" @click="runAction('discover', '/admin/contests/discover')">立即扫描第一页</FButton>
      </template>
    </PageHeader>

    <form class="card card__body cluster" @submit.prevent="archiveById">
      <FInput v-model.number="contestId" placeholder="比赛 ID" style="width:160px" aria-label="比赛 ID" />
      <FButton type="submit" appearance="primary" :disabled="!!busy || !contestId">立即归档</FButton>
      <span v-if="message" class="muted" style="font-size:13px">{{ message }}</span>
    </form>

    <div class="card">
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead><tr><th>比赛</th><th>人数</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in data?.items || []" :key="item.id">
              <td><strong>{{ item.name }}</strong><span class="muted" style="display:block;font-size:11px">#{{ item.id }}</span></td>
              <td class="tabular">{{ item.participant_count }}</td>
              <td>
                <span class="tag" :class="statusClass(item.status)">{{ statusText[item.status] || item.status }}</span>
                <span v-if="item.error_message" class="field-error" style="display:block;margin-top:3px">{{ item.error_message }}</span>
              </td>
              <td class="actions">
                <FButton appearance="subtle" size="small" :disabled="!!busy" @click="runAction('archive-' + item.id, '/admin/contests/archive', { body: { contest_id: item.id } })">重新归档</FButton>
                <FButton v-if="item.rated" appearance="subtle" size="small" :disabled="!!busy" @click="runAction('calc-' + item.id, '/admin/contests/' + item.id + '/recalculate')">重新计算</FButton>
                <FButton v-if="item.rated && item.status !== 'official'" appearance="subtle" size="small" :disabled="!!busy" @click="runAction('check-' + item.id, '/admin/contests/' + item.id + '/check-official')">检查正式结果</FButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
