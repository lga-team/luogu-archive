import { ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, MessagesSquare, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { UpdateButton } from './update-button'

export interface DiscussionForum { name: string; slug: string; count: number }
export interface DiscussionControlsProps {
  mode: 'header' | 'forums' | 'pagination' | 'retry'
  state?: string
  message?: string
  updatedAt?: string
  forums?: DiscussionForum[]
  selectedForum?: string
  page?: number
  totalPages?: number
  pending?: boolean
  onUpdate: () => void
  onForum: (slug: string) => void
  onPage: (page: number) => void
  onRetry: () => void
}

export function DiscussionControls(props: DiscussionControlsProps) {
  if (props.mode === 'header') return <div className="judgement-header-stack">
    <Card className="judgement-heading">
      <CardHeader className="judgement-heading-main">
        <MessagesSquare className="judgement-heading-icon" size={56} strokeWidth={1.8} aria-hidden="true" />
        <div className="judgement-heading-copy">
          <CardTitle><h1>讨论区</h1></CardTitle>
          <CardDescription>洛谷讨论主帖与回复归档</CardDescription>
        </div>
      </CardHeader>
    </Card>
    <Card className="judgement-toolbar">
      <CardFooter className="judgement-heading-footer">
        <span className="judgement-heading-updated">{props.updatedAt ? `上次更新：${props.updatedAt}` : ''}</span>
        <div className="judgement-heading-actions">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.luogu.com.cn/discuss" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />查看源站</a>
          </Button>
          <UpdateButton state={props.state || 'idle'} message={props.message || ''} onUpdate={props.onUpdate} />
        </div>
      </CardFooter>
    </Card>
  </div>

  if (props.mode === 'forums') return <Card className="discussion-forums">
    <CardHeader className="discussion-forums-heading"><CardTitle>版块</CardTitle></CardHeader>
    <nav className="discussion-forum-options" aria-label="讨论版块">
      <Button variant="ghost" className="discussion-forum-option" aria-pressed={!props.selectedForum} onClick={() => props.onForum('')}>
        <LayoutGrid size={14} aria-hidden="true" /><span>全部版块</span>
      </Button>
      {(props.forums || []).map(forum => <Button key={forum.slug} variant="ghost" className="discussion-forum-option" aria-pressed={props.selectedForum === forum.slug} onClick={() => props.onForum(forum.slug)}>
        <span className="discussion-forum-dot" data-forum={forum.slug} aria-hidden="true" />
        <span>{forum.name}</span><span className="discussion-forum-count">{forum.count.toLocaleString('zh-CN')}</span>
      </Button>)}
    </nav>
  </Card>

  if (props.mode === 'retry') return <Button variant="outline" size="sm" disabled={props.pending} onClick={props.onRetry}><RefreshCw size={14} aria-hidden="true" />重试</Button>

  const page = props.page || 1, totalPages = props.totalPages || 1
  return <nav className="discussion-pagination" aria-label="讨论列表分页">
    <Button variant="outline" size="sm" disabled={props.pending || page <= 1} onClick={() => props.onPage(page - 1)}><ChevronLeft size={14} aria-hidden="true" />上一页</Button>
    <span aria-live="polite">{page} / {totalPages}</span>
    <Button variant="outline" size="sm" disabled={props.pending || page >= totalPages} onClick={() => props.onPage(page + 1)}>下一页<ChevronRight size={14} aria-hidden="true" /></Button>
  </nav>
}
