<script setup lang="ts">
import { Megaphone } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

type Announcement = {
  id: number; title: string; summary: string; content: string
  is_published: boolean; published_at: string | null; created_at: string; updated_at: string
}
type AnnouncementForm = { title: string; summary: string; content: string; is_published: boolean }

const admin = useAdminStore()
const api = useAdminApi()
const announcements = ref<Announcement[]>([])
const loading = ref(true)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = ref<AnnouncementForm>(emptyForm())

function emptyForm(): AnnouncementForm {
  return { title: '', summary: '', content: '', is_published: true }
}
async function load() {
  loading.value = true
  try {
    announcements.value = await api<any[]>('/admin/announcements')
  } catch (error: any) {
    if (error?.status === 401 || error?.statusCode === 401) {
      admin.clear()
      await navigateTo('/admin/login')
      return
    }
    alert(error?.data?.message || '公告加载失败')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  if (!admin.isLoggedIn) { navigateTo('/admin/login'); return }
  load()
})
function edit(item: Announcement) {
  editingId.value = item.id
  form.value = { title: item.title, summary: item.summary, content: item.content, is_published: item.is_published }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function resetForm() { editingId.value = null; form.value = emptyForm() }
async function save() {
  const body = { title: form.value.title.trim(), summary: form.value.summary.trim(), content: form.value.content.trim(), is_published: form.value.is_published }
  if (!body.title || !body.summary || !body.content) { alert('请填写标题、摘要和正文'); return }
  saving.value = true
  try {
    if (editingId.value === null) await api('/admin/announcements', { method: 'POST', body })
    else await api(`/admin/announcements/${editingId.value}`, { method: 'PUT', body })
    resetForm()
    await load()
  } catch (error: any) {
    alert(error?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
async function togglePublished(item: Announcement) {
  const action = item.is_published ? 'unpublish' : 'publish'
  try { await api(`/admin/announcements/${item.id}/${action}`, { method: 'POST' }); await load() }
  catch (error: any) { alert(error?.data?.message || '操作失败') }
}
async function remove(item: Announcement) {
  if (!window.confirm('确定彻底删除公告“' + item.title + '”吗？')) return
  try {
    await api(`/admin/announcements/${item.id}`, { method: 'DELETE' })
    if (editingId.value === item.id) resetForm()
    await load()
  } catch (error: any) { alert(error?.data?.message || '删除失败') }
}
function formatTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div class="page">
    <PageHeader title="站点公告" description="首页仅显示已发布公告，按最近发布时间排序。" eyebrow="Announcements">
      <template #icon><Megaphone :size="26" aria-hidden="true" style="color: var(--colorBrandForeground1)" /></template>
      <template #actions>
        <FButton v-if="editingId !== null" appearance="outline" @click="resetForm">取消编辑</FButton>
      </template>
    </PageHeader>

    <section class="card">
      <div class="card__header">
        <h2 class="card__title">{{ editingId === null ? '新建公告' : '编辑公告 #' + editingId }}</h2>
      </div>
      <div class="card__body form">
        <div class="stack stack--xs"><label class="field-label">标题</label><FInput v-model="form.title" :maxlength="200" placeholder="公告标题" /></div>
        <div class="stack stack--xs"><label class="field-label">首页摘要</label><FInput v-model="form.summary" :maxlength="500" placeholder="一行说明公告内容" /></div>
        <div class="stack stack--xs"><label class="field-label">正文</label><FTextarea v-model="form.content" :maxlength="20000" :rows="8" placeholder="公告完整内容（支持 Markdown）" /></div>
        <div class="form-actions" style="justify-content:space-between">
          <FSwitch v-model="form.is_published" label="保存后立即发布到首页" />
          <FButton appearance="primary" :loading="saving" @click="save">{{ saving ? '保存中…' : editingId === null ? '保存公告' : '更新公告' }}</FButton>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card__header">
        <div><h2 class="card__title">全部公告</h2><p class="card__description">{{ announcements.length }} 条</p></div>
      </div>
      <LoadingPanel v-if="loading" compact title="正在加载公告" />
      <EmptyState v-else-if="!announcements.length" title="暂无公告" />
      <div v-else class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead><tr><th>状态</th><th>公告</th><th>发布时间</th><th>更新时间</th><th style="text-align:right">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in announcements" :key="item.id">
              <td><span class="tag" :class="item.is_published ? 'tag--success' : ''">{{ item.is_published ? '已发布' : '草稿' }}</span></td>
              <td style="min-width:260px">
                <strong>{{ item.title }}</strong>
                <span class="muted" style="display:block;font-size:12px;max-width:480px">{{ item.summary }}</span>
              </td>
              <td class="nowrap muted">{{ formatTime(item.published_at) }}</td>
              <td class="nowrap muted">{{ formatTime(item.updated_at) }}</td>
              <td class="actions">
                <FButton appearance="subtle" size="small" @click="edit(item)">编辑</FButton>
                <FButton appearance="subtle" size="small" @click="togglePublished(item)">{{ item.is_published ? '撤下' : '发布' }}</FButton>
                <FButton appearance="subtle" size="small" @click="remove(item)">删除</FButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
