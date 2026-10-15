import { ExternalLink, Gavel, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'

export interface JudgementHeaderProps {
  state: string
  message: string
  updatedAt: string
  onUpdate: () => void
}

export function JudgementHeader({ state, message, updatedAt, onUpdate }: JudgementHeaderProps) {
  const pending = state === 'pending'
  return (
    <div className="judgement-header-stack">
      <Card className="judgement-heading">
      <CardHeader className="judgement-heading-main">
        <Gavel className="judgement-heading-icon" size={56} strokeWidth={1.8} aria-hidden="true" />
        <div className="judgement-heading-copy">
          <CardTitle><h1>陶片放逐</h1></CardTitle>
          <CardDescription>洛谷社区用户权限变更记录</CardDescription>
        </div>
      </CardHeader>
      </Card>
      <Card className="judgement-toolbar">
      <CardFooter className="judgement-heading-footer">
        <span className="judgement-heading-updated">{updatedAt ? `上次更新：${updatedAt}` : ''}</span>
        <div className="judgement-heading-actions">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.luogu.com.cn/judgement" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden="true" />查看源站
            </a>
          </Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={onUpdate}>
            {pending ? <LoaderCircle className="settings-spin" size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            更新
          </Button>
        </div>
        {message && <p className="judgement-heading-message" data-state={state} role="status">{message}</p>}
      </CardFooter>
      </Card>
    </div>
  )
}
