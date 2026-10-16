import { Activity, Archive, BookOpenText, Clipboard, Gavel, ListChecks, MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { UpdateButton } from './update-button'

export interface SiteOverviewData {
  generated_at: string
  totals: { crawl_tasks: number; articles: number; pastes: number; feeds: number; judgements: number }
  queues: { key: string; label: string; size: number }[]
  recent_tasks: RecentTask[]
}
interface RecentTask { id: number; task_type: string; target: string; trigger: string; status: string; started_at: string }
export interface SiteOverviewProps {
  data: SiteOverviewData | null
  pending: boolean
  error: string
  refreshState: string
  onRefresh: () => void
  formatTime: (value: string) => string
  formatTimestamp: (value: string) => string
}
const metrics = [
  { key: 'crawl_tasks', label: '总保存任务', icon: ListChecks },
  { key: 'articles', label: '文章', icon: BookOpenText },
  { key: 'pastes', label: '剪贴板', icon: Clipboard },
  { key: 'feeds', label: '犇犇', icon: MessageSquare },
  { key: 'judgements', label: '陶片记录', icon: Gavel },
] as const
const taskTypes: Record<string, string> = {
  article: '文章', paste: '剪贴板', discussion: '讨论', discuss: '讨论', feed: '犇犇',
  judgement: '陶片', user: '用户', theme: '主题', problem: '题目', problem_list: '题目列表',
  problem_catalog: '题库同步', problem_solution: '题解状态', contest: '比赛', contest_scoreboard: '比赛榜单',
}
const triggers: Record<string, string> = {
  manual: '手动', scheduled: '定时', passive: '访问触发', realtime: '实时监听', discovery: '入口发现', internal: '内部调度',
}
const statuses: Record<string, string> = {
  pending: '等待中', running: '运行中', success: '成功', failed: '失败', skipped: '已跳过', rate_limited: '限流',
}
const numberText = (value: number) => value.toLocaleString('zh-CN')
function TaskStatus({ value }: { value: string }) {
  return <span className="site-task-status" data-status={value}><span aria-hidden="true" />{statuses[value] || value}</span>
}
function TaskTime({ task, formatTime, formatTimestamp }: { task: RecentTask } & Pick<SiteOverviewProps, 'formatTime' | 'formatTimestamp'>) {
  return <time dateTime={task.started_at} title={formatTimestamp(task.started_at)}>{formatTime(task.started_at)}</time>
}
export function SiteOverview(props: SiteOverviewProps) {
  const { data, pending, error } = props
  const queueTotal = data?.queues.reduce((total, queue) => total + queue.size, 0)
  return <div className="site-overview">
    <div className="judgement-header-stack">
      <Card className="judgement-heading"><CardHeader className="judgement-heading-main">
        <Activity className="judgement-heading-icon" size={56} strokeWidth={1.8} aria-hidden="true" />
        <div className="judgement-heading-copy"><CardTitle><h1>站点概览</h1></CardTitle><CardDescription>归档统计与任务状态</CardDescription></div>
      </CardHeader></Card>
      <Card className="judgement-toolbar"><CardFooter className="judgement-heading-footer">
        <span className="judgement-heading-updated">{data ? <>更新于 <time dateTime={data.generated_at}>{props.formatTimestamp(data.generated_at)}</time></> : '等待数据'}</span>
        <UpdateButton state={pending ? 'pending' : props.refreshState} message={error} onUpdate={props.onRefresh} />
      </CardFooter></Card>
    </div>
    {error && <div className="site-overview-error" role="alert"><span>{data ? `刷新失败，当前保留上次数据。${error}` : `统计加载失败。${error}`}</span><Button variant="outline" size="sm" disabled={pending} onClick={props.onRefresh}><RefreshCw size={14} aria-hidden="true" />重试</Button></div>}
    <section aria-label="站点总量" aria-busy={pending && !data} className="site-metrics">
      {metrics.map(({ key, label, icon: Icon }) => <Card key={key} className="site-metric">
        <div className="site-metric-label"><Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></div>
        <strong className="site-metric-value" data-long={data && String(data.totals[key]).length > 10 ? true : undefined}>{data ? numberText(data.totals[key]) : '—'}</strong>
      </Card>)}
    </section>
    <section className="site-section" aria-labelledby="site-queues-heading" aria-busy={pending && !data}>
      <header className="site-section-heading"><h2 id="site-queues-heading">处理通道</h2><span>{queueTotal === undefined ? '—' : `合计 ${numberText(queueTotal)} 个任务`}</span></header>
      {data ? data.queues.length ? <dl className="site-queues">{data.queues.map(queue => <div key={queue.key} className="site-queue"><dt><span>{queue.label}</span><code>{queue.key}</code></dt><dd>{numberText(queue.size)}</dd></div>)}</dl> : <p className="site-overview-empty">暂无队列数据</p> : <p className="site-overview-empty" role="status">{pending ? 'loading……' : '暂无队列数据'}</p>}
    </section>
    <section className="site-section" aria-labelledby="site-recent-heading" aria-busy={pending && !data}>
      <header className="site-section-heading"><h2 id="site-recent-heading">最近保存任务</h2><Archive size={17} aria-hidden="true" /></header>
      {!data ? <p className="site-overview-empty" role="status">{pending ? 'loading……' : '暂无任务数据'}</p> : !data.recent_tasks.length ? <p className="site-overview-empty">暂无爬取任务</p> : <>
        <div className="site-tasks-table"><table><caption className="site-sr-only">最近保存任务，按开始时间倒序</caption><thead><tr><th scope="col">类型</th><th scope="col">目标</th><th scope="col">触发</th><th scope="col">状态</th><th scope="col">时间</th></tr></thead>
          <tbody>{data.recent_tasks.map(task => <tr key={task.id}><td>{taskTypes[task.task_type] || task.task_type}</td><td><code>{task.target}</code></td><td>{triggers[task.trigger] || task.trigger}</td><td><TaskStatus value={task.status} /></td><td><TaskTime task={task} {...props} /></td></tr>)}</tbody>
        </table></div>
        <ul className="site-task-list" aria-label="最近保存任务">{data.recent_tasks.map(task => <li key={task.id}>
          <div className="site-task-mobile-heading"><strong>{taskTypes[task.task_type] || task.task_type}</strong><TaskStatus value={task.status} /></div><code>{task.target}</code><div className="site-task-mobile-meta"><span>{triggers[task.trigger] || task.trigger}</span><TaskTime task={task} {...props} /></div>
        </li>)}</ul>
      </>}
    </section>
  </div>
}
