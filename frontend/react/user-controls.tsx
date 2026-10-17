import { Activity, ArrowDown, ChartNoAxesColumn, Check, Copy, ExternalLink, FileText, History, LoaderCircle, RefreshCw, Trophy, UserPlus, UserRoundCheck } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardFooter } from './ui/card'
import { Switch } from './ui/switch'
import { UpdateButton } from './update-button'

export interface UserControlsProps {
  mode: 'toolbar' | 'tabs' | 'filters' | 'follow' | 'card' | 'more' | 'copy' | 'retry'
  uid?: string
  state?: string
  message?: string
  updatedAt?: string
  activeTab?: string
  tabs?: Array<{ key: string; label: string }>
  includeFeed?: boolean
  includeDiscussion?: boolean
  pending?: boolean
  following?: boolean
  showProfileActions?: boolean
  copied?: boolean
  disabled?: boolean
  onUpdate: () => void
  onTab: (tab: string) => void
  onFeed: (value: boolean) => void
  onDiscussion: (value: boolean) => void
  onAction: () => void
  onFollow: () => void
  onCard: () => void
}

const tabIcons = { activity: Activity, intro: FileText, prizes: Trophy, names: History }

export function UserControls(props: UserControlsProps) {
  if (props.mode === 'toolbar') return <Card className="judgement-toolbar user-profile-toolbar">
    <CardFooter className="judgement-heading-footer">
      <span className="judgement-heading-updated">{props.updatedAt ? `上次更新：${props.updatedAt}` : ''}</span>
      <div className="judgement-heading-actions user-profile-actions" data-full={props.showProfileActions ? 'true' : undefined}>
        {props.showProfileActions && <>
          <UserControls {...props} mode="follow" onAction={props.onFollow} />
          <UserControls {...props} mode="card" onAction={props.onCard} />
        </>}
        <Button variant="outline" size="sm" asChild><a href={`https://www.luogu.com.cn/user/${props.uid}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />查看源站</a></Button>
        <UpdateButton state={props.state || 'idle'} message={props.message || ''} onUpdate={props.onUpdate} />
      </div>
      {props.state === 'captcha' && props.message && <p className="judgement-heading-message" role="status">{props.message}</p>}
    </CardFooter>
  </Card>

  if (props.mode === 'tabs') return <Card className="user-section-navigation">
    <nav aria-label="用户档案栏目" className="user-section-tabs">{(props.tabs || []).map(tab => {
      const Icon = tabIcons[tab.key as keyof typeof tabIcons] || FileText
      return <Button key={tab.key} variant="ghost" className="user-section-tab" aria-pressed={props.activeTab === tab.key} onClick={() => props.onTab(tab.key)}><Icon size={15} aria-hidden="true" />{tab.label}</Button>
    })}</nav>
  </Card>

  if (props.mode === 'filters') return <div className="user-activity-filters">
    <label><Switch checked={props.includeFeed} onCheckedChange={props.onFeed} aria-label="显示犇犇" />显示犇犇</label>
    <label><Switch checked={props.includeDiscussion} onCheckedChange={props.onDiscussion} aria-label="显示讨论" />显示讨论</label>
  </div>

  if (props.mode === 'card') return <Button variant="outline" size="sm" asChild><a href={`/user/${props.uid}/card`} onClick={event => { event.preventDefault(); props.onAction() }}><ChartNoAxesColumn size={14} aria-hidden="true" />图卡</a></Button>

  if (props.mode === 'retry') return <Button variant="outline" size="sm" disabled={props.pending} onClick={props.onAction}><RefreshCw size={14} aria-hidden="true" />重试</Button>

  if (props.mode === 'follow') return <Button variant={props.following ? 'outline' : 'default'} size="sm" disabled={props.pending} onClick={props.onAction}>
    {props.pending ? <LoaderCircle size={14} className="user-control-spin" aria-hidden="true" /> : props.following ? <UserRoundCheck size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
    {props.following ? '取消关注' : '关注'}
  </Button>

  if (props.mode === 'copy') return <Button variant="outline" size="sm" disabled={props.disabled} onClick={props.onAction}>
    {props.copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{props.copied ? '已复制' : '复制原文'}
  </Button>

  return <Button variant="outline" size="sm" disabled={props.pending} onClick={props.onAction}>
    {props.pending ? <LoaderCircle size={14} className="user-control-spin" aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}{props.pending ? '加载中…' : '加载更多'}
  </Button>
}
