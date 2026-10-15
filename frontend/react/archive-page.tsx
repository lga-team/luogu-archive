import * as React from 'react'
import { ArrowRight, ArrowLeft, Search, Megaphone, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { parseArchiveAddress } from './parse-address'

export interface Announcement { id: number; title: string; summary: string; content: string; published_at: string }
export interface ArchivePageProps {
  page: 'home' | 'announcement'
  selectedId: number | null
  extended: boolean
  loadAnnouncements: () => Promise<Announcement[]>
  navigate: (path: string) => void
  renderMarkdown: (value: string) => string
  onReady?: () => void
}
const readKey = 'archive-read-announcements-v1'

function announcementKey(item: Announcement) { return `${item.id}:${item.published_at}` }
function readAnnouncements(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(readKey) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

export function ArchivePage(props: ArchivePageProps) {
  const [input, setInput] = React.useState('')
  const [error, setError] = React.useState('')
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const [read, setRead] = React.useState<string[]>(readAnnouncements)
  const [compact, setCompact] = React.useState(() => window.matchMedia('(max-width: 640px)').matches)
  const logo = React.useRef<HTMLImageElement>(null)

  React.useLayoutEffect(() => {
    if (props.page !== 'home') return
    let active = true
    const reveal = () => { if (active) props.onReady?.() }
    if (logo.current) void logo.current.decode().catch(() => {}).then(reveal)
    else reveal()
    return () => { active = false }
  }, [props.page, props.onReady])

  // 窄屏缩短输入提示，避免文字被搜索按钮挤掉；浏览器切换尺寸时同步更新。
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // 公告独立加载，不阻塞主页输入；卸载后丢弃迟到的接口结果。
  React.useEffect(() => {
    let active = true
    setLoading(true)
    setFailed(false)
    props.loadAnnouncements().then(items => { if (active) setAnnouncements(items) })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])

  const selected = announcements.find(item => item.id === props.selectedId)
  React.useEffect(() => {
    if (!selected) return
    const key = announcementKey(selected)
    const next = Array.from(new Set([...readAnnouncements(), key])).slice(-200)
    // 隐私模式可能禁用存储，仍允许当前页面正常阅读。
    try { localStorage.setItem(readKey, JSON.stringify(next)) } catch {}
    setRead(next)
  }, [selected?.id, selected?.published_at])
  // 只提醒最新公告，读完后不把多年以前的公告逐条当作新公告弹出。
  const latest = announcements[0]
  const unread = latest && !read.includes(announcementKey(latest)) ? latest : null

  const notice = unread && props.page === 'home' ? (
    <a className="archive-notice" href={`/announcement?id=${unread.id}`} onClick={event => { event.preventDefault(); props.navigate(`/announcement?id=${unread.id}`) }}>
      <Megaphone size={17} aria-hidden="true" /><span>新公告：{unread.title}</span><ChevronRight size={17} aria-hidden="true" />
    </a>
  ) : null

  if (props.page === 'home') return <>
    <div className="archive-home-notice">{notice}</div>
    <section className="archive-home">
      <div className="archive-wordmark"><img ref={logo} src="/favicon.png" alt="" /><h1>洛谷档案馆</h1></div>
      <form className="archive-search" onSubmit={event => {
        event.preventDefault()
        try { setError(''); props.navigate(parseArchiveAddress(input, props.extended)) }
        catch (reason) { setError((reason as Error).message) }
      }}>
        <Search className="archive-search-icon" size={22} aria-hidden="true" />
        <Input aria-label="洛谷链接" placeholder={compact ? '输入洛谷主站链接' : '输入洛谷主站的地址，打开对应页面'} value={input} onChange={event => { setInput(event.target.value); setError('') }} autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? 'archive-search-error' : undefined} />
        <Button type="submit" size="icon" variant="ghost" title="打开对应页面" aria-label="打开对应页面" disabled={!input.trim()}><ArrowRight size={21} /></Button>
      </form>
      {error && <p id="archive-search-error" className="archive-error" role="alert">{error}</p>}
    </section>
    <a className="archive-announcement-entry" href="/announcement" onClick={event => { event.preventDefault(); props.navigate('/announcement') }}><Megaphone size={15} />站点公告</a>
  </>

  return <section className="archive-announcements">
    <header className="archive-announcement-heading">
      <div><span className="archive-eyebrow">洛谷档案馆</span><h1>站点公告</h1></div>
      {selected && <Button variant="ghost" onClick={() => props.navigate('/announcement')}><ArrowLeft size={16} />全部公告</Button>}
    </header>
    {loading ? <p role="status" className="archive-muted">loading……</p> : failed ? <div className="archive-load-error" role="alert"><p>公告加载失败，请稍后重试。</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} />重试</Button></div> : selected ? <article>
      <h2 className="archive-detail-title">{selected.title}</h2>
      <time className="archive-muted" dateTime={selected.published_at}>{formatDate(selected.published_at)}</time>
      <div className="markdown-body archive-announcement-content" dangerouslySetInnerHTML={{ __html: props.renderMarkdown(selected.content) }} />
    </article> : <>
      {props.selectedId && <p role="alert" className="archive-error">未找到这条公告，以下为现有公告。</p>}
      {!announcements.length && <p className="archive-muted">暂无公告。</p>}
      <div className="archive-announcement-list">{announcements.map(item => <article key={item.id}>
        <a href={`/announcement?id=${item.id}`} onClick={event => { event.preventDefault(); props.navigate(`/announcement?id=${item.id}`) }}>
          <div><time dateTime={item.published_at}>{formatDate(item.published_at)}</time><h2>{item.title}</h2>{item.summary && <p>{item.summary}</p>}</div><ChevronRight size={20} aria-hidden="true" />
        </a>
      </article>)}</div>
    </>}
  </section>
}
