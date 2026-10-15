import { useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Gavel, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

export interface JudgementHeaderProps {
  state: string
  message: string
  updatedAt: string
  onUpdate: () => void
}

export function JudgementHeader({ state, message, updatedAt, onUpdate }: JudgementHeaderProps) {
  const pending = state === 'pending'
  const [feedback, setFeedback] = useState<{ status: 'idle' | 'success' | 'failed'; result: 'success' | 'failed' }>({ status: 'idle', result: 'success' })
  const feedbackTimer = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined)
  const [errorOpen, setErrorOpen] = useState(false)
  const [failureReason, setFailureReason] = useState('')
  const updateRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (state === 'pending') {
      window.clearTimeout(feedbackTimer.current)
      setFeedback(previous => ({ ...previous, status: 'idle' }))
      return
    }
    if (state !== 'success' && state !== 'failed' && state !== 'cooldown') return
    const failed = state !== 'success'
    const result = failed ? 'failed' : 'success'
    setFeedback({ status: result, result })
    if (failed) {
      setFailureReason(message || '更新请求未能提交，请稍后重试。')
      setErrorOpen(true)
    }
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback(previous => ({ ...previous, status: 'idle' }))
    }, 2000)
  }, [state, message])

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])

  const buttonState = pending ? 'pending' : feedback.status
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
          <Button
            ref={updateRef}
            variant="outline"
            size="sm"
            className="judgement-update"
            data-feedback={buttonState}
            disabled={pending}
            aria-disabled={pending || feedback.status !== 'idle'}
            aria-busy={pending}
            aria-label={pending ? '正在提交更新' : feedback.status === 'success' ? '更新请求已提交' : feedback.status === 'failed' ? '更新失败' : '更新'}
            onClick={() => { if (feedback.status === 'idle') onUpdate() }}
          >
            <span className="judgement-update-label" aria-hidden="true">
              <RefreshCw className={pending ? 'settings-spin' : undefined} size={14} />更新
            </span>
            <span className="judgement-update-result" aria-hidden="true">
              {feedback.result === 'success' ? <Check size={18} /> : <X size={18} />}
            </span>
          </Button>
        </div>
        {state === 'captcha' && message && <p className="judgement-heading-message" role="status">{message}</p>}
        <span className="judgement-update-announcement" role="status">{buttonState === 'success' ? message : buttonState === 'failed' ? '更新失败' : ''}</span>
      </CardFooter>
      </Card>
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="judgement-failure-dialog" overlayClassName="judgement-failure-overlay" onCloseAutoFocus={(event) => { event.preventDefault(); updateRef.current?.focus() }}>
          <DialogHeader>
            <DialogTitle className="judgement-failure-title">
              <span className="judgement-failure-icon"><X size={20} aria-hidden="true" /></span>
              更新失败
            </DialogTitle>
            <DialogDescription className="judgement-failure-reason">{failureReason}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm" className="judgement-confirm">知道了</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
