import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import './update-button.css'

export interface UpdateButtonProps {
  state: string
  message: string
  onUpdate: () => void
  disabled?: boolean
}

// Request ownership stays with the page/SaveButton; this component owns feedback.
export function UpdateButton({ state, message, onUpdate, disabled = false }: UpdateButtonProps) {
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
    const result = state === 'success' ? 'success' : 'failed'
    setFeedback({ status: result, result })
    if (result === 'failed') {
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
    <>
      <Button
        ref={updateRef}
        variant="outline"
        size="sm"
        className="archive-update"
        data-feedback={buttonState}
        disabled={pending || disabled}
        aria-disabled={pending || disabled || feedback.status !== 'idle'}
        aria-busy={pending}
        aria-label={pending ? '正在提交更新' : feedback.status === 'success' ? '更新请求已提交' : feedback.status === 'failed' ? '更新失败' : '更新'}
        onClick={() => { if (!pending && !disabled && feedback.status === 'idle') onUpdate() }}
      >
        <span className="archive-update-label" aria-hidden="true">
          <RefreshCw className={pending ? 'archive-update-spin' : undefined} size={14} />更新
        </span>
        <span className="archive-update-result" aria-hidden="true">
          {feedback.result === 'success'
            ? <><CircleCheck size={14} strokeWidth={1.75} />成功</>
            : <><CircleX size={14} strokeWidth={1.75} />失败</>}
        </span>
      </Button>
      <span className="archive-update-announcement" role="status">{buttonState === 'success' ? message : buttonState === 'failed' ? '更新失败' : ''}</span>
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="archive-update-dialog" overlayClassName="archive-update-overlay" onCloseAutoFocus={(event) => { event.preventDefault(); updateRef.current?.focus() }}>
          <DialogHeader>
            <DialogTitle className="archive-update-failure-title">
              <span className="archive-update-failure-icon"><X size={20} aria-hidden="true" /></span>
              更新失败
            </DialogTitle>
            <DialogDescription className="archive-update-failure-reason">{failureReason}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm" className="archive-update-confirm">知道了</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
