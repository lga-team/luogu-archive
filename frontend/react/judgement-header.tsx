import { ExternalLink, Gavel } from 'lucide-react'
import { useLayoutEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { UpdateButton } from './update-button'

export interface JudgementHeaderProps {
  state: string
  message: string
  updatedAt: string
  onUpdate: () => void
  onReady?: () => void
}

export function JudgementHeader({ state, message, updatedAt, onUpdate, onReady }: JudgementHeaderProps) {
  useLayoutEffect(() => { onReady?.() }, [onReady])
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
            <UpdateButton state={state} message={message} onUpdate={onUpdate} />
          </div>
          {state === 'captcha' && message && <p className="judgement-heading-message" role="status">{message}</p>}
        </CardFooter>
      </Card>
    </div>
  )
}
