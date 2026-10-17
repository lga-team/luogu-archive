interface DocumentAuthor {
  uid: number
  name: string
  color: string
  badge: string | null
  avatar: string | null
  ccf_level?: number
  xcpc_level?: number
  is_admin?: boolean
}

interface ArchiveDocumentDetail {
  title?: string
  content_md: string
  admin_note?: string | null
  author: DocumentAuthor | null
  source_time?: string | null
  last_crawled_at?: string | null
  crawled_at: string
  version_count: number
}

interface ArchiveDocumentVersion {
  id: number | null
  title: string | null
  content_md: string
  crawled_at: string
  is_current: boolean
}

export function useArchiveDocument(type: 'article' | 'paste', id: string) {
  const api = useApi()
  const route = useRoute()
  const label = type === 'article' ? '文章' : '剪贴板'
  const { data, pending, error, refresh } = useLazyAsyncData(
    `${type}-${id}`,
    () => api<ArchiveDocumentDetail>(`/${type}/${id}`),
    { server: false },
  )
  const history = useLazyAsyncData(
    `${type}-reader-history-${id}`,
    () => data.value
      ? api<{ versions: ArchiveDocumentVersion[] }>(`/${type}/${id}/history`)
      : Promise.resolve(null),
    { server: false, watch: [data] },
  )
  const versions = computed(() => {
    const entries = [...(history.data.value?.versions || [])].sort((a, b) =>
      new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime()
      || (b.id || 0) - (a.id || 0),
    )
    if (!entries.length && data.value) {
      entries.push({
        id: null,
        title: data.value.title ?? null,
        content_md: data.value.content_md,
        crawled_at: data.value.crawled_at,
        is_current: true,
      })
    }
    return entries.map((version, index) => ({
      ...version,
      number: entries.length === 1 ? data.value?.version_count || 1 : entries.length - index,
    }))
  })
  const requestedVersion = computed(() => {
    const value = route.query.version
    if (value === undefined) return null
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return NaN
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : NaN
  })
  const selected = computed(() => {
    if (requestedVersion.value !== null) {
      return versions.value.find(version => version.id === requestedVersion.value) || null
    }
    return versions.value.find(version => version.is_current) || null
  })
  const historical = computed(() => Boolean(selected.value && !selected.value.is_current))
  const title = computed(() => type === 'paste'
    ? `剪贴板 ${id}`
    : selected.value?.title ?? data.value?.title ?? '文章',
  )
  const { render } = useMarkdown()
  const html = computed(() => selected.value ? render(selected.value.content_md) : '')

  function selectVersion(version: (typeof versions.value)[number]) {
    const query = { ...route.query }
    if (version.is_current || version.id === null) delete query.version
    else query.version = String(version.id)
    return navigateTo({ path: `/${type}/${id}`, query, hash: '' })
  }
  function showLatest() {
    const query = { ...route.query }
    delete query.version
    return navigateTo({ path: `/${type}/${id}`, query, hash: '' })
  }
  useHead(() => ({ title: `${title.value} - 洛谷档案馆` }))

  return {
    label, data, pending, error, refresh, versions, selected, historical, title, html,
    historyPending: history.pending, historyError: history.error, refreshHistory: history.refresh,
    selectVersion, showLatest,
  }
}
