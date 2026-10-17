import { useRef } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

interface LoginRequiredDialogProps {
  open: boolean
  onClose: () => void
  onLogin: () => void
}

export function LoginRequiredDialog({ open, onClose, onLogin }: LoginRequiredDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent className="login-required-dialog" overlayClassName="login-required-overlay" onOpenAutoFocus={() => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }} onCloseAutoFocus={event => {
      event.preventDefault()
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
    }}>
      <DialogHeader>
        <DialogTitle>请先登录</DialogTitle>
        <DialogDescription>登录后即可关注该用户。是否前往登录？</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}><ArrowLeft size={14} aria-hidden="true" />返回</Button>
        <Button size="sm" onClick={onLogin}><LogIn size={14} aria-hidden="true" />登录</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
