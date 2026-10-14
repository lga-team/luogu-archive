import * as React from 'react'
import { Eye, EyeOff, LogOut, Monitor, Moon, Sun, UserRound, Palette, LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'
import { Textarea } from './ui/textarea'

export interface SettingsAccount {
  email: string
  display_name: string
  luogu_uid: number | null
  luogu_bound_at: string | null
}
export interface SettingsPageProps {
  initialized: boolean
  loggedIn: boolean
  displayName: string
  email: string
  account: SettingsAccount | null
  loading: boolean
  loggingOut: boolean
  error: string
  theme: string
  login: (data: { email: string; password: string }) => Promise<void>
  resend: (email: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  retry: () => void
  challenge: () => Promise<{ verification_text: string }>
  verify: (pasteId: string) => Promise<void>
  changeTheme: (theme: string) => void
  navigate: (path: string) => void
}
function errorMessage(reason: unknown, fallback: string): string {
  return (reason as { data?: { message?: string } })?.data?.message || fallback
}

function LoginForm({ login, resend, navigate }: Pick<SettingsPageProps, 'login' | 'resend' | 'navigate'>) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [visible, setVisible] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needVerify, setNeedVerify] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [cooldown, setCooldown] = React.useState(0)
  React.useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true); setError(''); setNeedVerify(false); setMessage('')
    try { await login({ email, password }) }
    catch (reason) {
      const text = errorMessage(reason, '登录失败')
      setError(text); setNeedVerify(text.includes('验证邮箱'))
    } finally { setPending(false) }
  }
  async function sendVerification() {
    if (sending || cooldown) return
    if (!email) { setMessage('请先填写邮箱'); return }
    setSending(true); setMessage('')
    try { const data = await resend(email); setMessage(data.message || '已发送，请查收'); setCooldown(60) }
    catch (reason) {
      setMessage(errorMessage(reason, '发送失败'))
      const retry = (reason as { data?: { data?: { retry_after_sec?: number } } })?.data?.data?.retry_after_sec
      if (typeof retry === 'number' && retry > 0) setCooldown(Math.ceil(retry))
    } finally { setSending(false) }
  }

  return <div className="settings-login">
    <form className="settings-form" onSubmit={submit}>
      <div className="settings-field"><Label htmlFor="settings-email">邮箱</Label><Input id="settings-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" required /></div>
      <div className="settings-field"><Label htmlFor="settings-password">密码</Label><div className="settings-password">
        <Input id="settings-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
        <Button type="button" size="icon" variant="ghost" aria-label={visible ? '隐藏密码' : '显示密码'} title={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
      </div></div>
      {error && <p className="archive-error settings-message" role="alert">{error}</p>}
      <Button type="submit" disabled={pending} className="settings-submit">{pending && <LoaderCircle className="settings-spin" size={16} aria-hidden="true" />}{pending ? '登录中…' : '登录'}</Button>
    </form>
    {needVerify && <div className="settings-verification">
      <Button type="button" variant="outline" disabled={sending || cooldown > 0} onClick={sendVerification}>{sending ? '正在发送…' : cooldown ? `重新发送（${cooldown}s）` : '重新发送验证邮件'}</Button>
      {message && <p className="settings-message archive-muted" role="status">{message}</p>}
    </div>}
    <div className="settings-register"><span>还没有账号？</span><Button asChild variant="ghost"><a href="/register" onClick={event => { event.preventDefault(); navigate('/register') }}>创建账号</a></Button></div>
  </div>
}

const themes = [{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }, { value: 'system', label: '跟随系统', icon: Monitor }]
export function LoginPage(props: SettingsPageProps) {
  return <div className="settings-shell settings-login-shell">
    <header className="settings-heading"><h1>登录</h1></header>
    {props.initialized ? <LoginForm login={props.login} resend={props.resend} navigate={props.navigate} /> : <p className="archive-muted" role="status">正在恢复登录状态…</p>}
  </div>
}
function BindingDialog({ challenge, verify }: Pick<SettingsPageProps, 'challenge' | 'verify'>) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const [paste, setPaste] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [verifying, setVerifying] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const request = React.useRef(0)
  React.useEffect(() => () => { request.current += 1 }, [])
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])
  async function changeOpen(value: boolean) {
    if (verifying) return
    const current = ++request.current
    setOpen(value)
    if (!value) return
    setLoading(true); setText(''); setError(''); setPaste(''); setCopied(false)
    try { const data = await challenge(); if (current === request.current) setText(data.verification_text) }
    catch (reason) { if (current === request.current) setError(errorMessage(reason, '生成验证文本失败')) }
    finally { if (current === request.current) setLoading(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true) }
    catch { setError('复制失败，请手动复制验证文本') }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (verifying || !text) return
    if (!paste.trim()) { setError('请输入剪贴板 ID 或链接'); return }
    setVerifying(true); setError('')
    try { await verify(paste.trim()); setOpen(false) }
    catch (reason) { setError(errorMessage(reason, '验证失败，请检查剪贴板内容和公开状态')) }
    finally { setVerifying(false) }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button>绑定账号</Button></DialogTrigger>
    <DialogContent onEscapeKeyDown={event => { if (verifying) event.preventDefault() }} onPointerDownOutside={event => { if (verifying) event.preventDefault() }}>
      <DialogHeader><DialogTitle>绑定洛谷账号</DialogTitle><DialogDescription>将验证文本粘贴到该账号的公开剪贴板。</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="settings-form">
        {loading ? <p className="archive-muted" role="status">正在生成验证文本…</p> : text ? <>
          <div className="settings-field"><Label htmlFor="settings-bind-text">验证文本</Label><Textarea id="settings-bind-text" readOnly value={text} rows={4} /><div className="settings-copy-actions"><Button type="button" variant="outline" onClick={copy}>{copied ? '已复制' : '复制文本'}</Button><Button asChild variant="ghost"><a href="https://www.luogu.com.cn/paste" target="_blank" rel="noopener noreferrer">新建剪贴板</a></Button></div></div>
          <div className="settings-field"><Label htmlFor="settings-paste">剪贴板</Label><Input id="settings-paste" value={paste} onChange={event => setPaste(event.target.value)} placeholder="ID、/paste/ID 或完整链接" autoComplete="off" disabled={verifying} required /></div>
        </> : null}
        {error && <div role="alert"><p className="archive-error settings-message">{error}</p>{!text && !loading && <Button type="button" variant="outline" onClick={() => changeOpen(true)}>重试</Button>}</div>}
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={verifying}>取消</Button></DialogClose><Button type="submit" disabled={loading || verifying || !text}>{verifying ? '正在验证…' : '验证并绑定'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
export function SettingsPage(props: SettingsPageProps) {
  return <div className="settings-shell">
    <header className="settings-heading"><h1>设置</h1></header>
    <Tabs defaultValue="account">
      <TabsList aria-label="设置分类"><TabsTrigger value="account"><UserRound size={16} aria-hidden="true" />账号</TabsTrigger><TabsTrigger value="appearance"><Palette size={16} aria-hidden="true" />外观</TabsTrigger></TabsList>
      <TabsContent value="account">
        {!props.initialized ? <p className="archive-muted" role="status">正在恢复登录状态…</p> : !props.loggedIn ? <>
          <div className="settings-section-heading"><h2>登录账号</h2><span className="settings-status">未登录</span></div>
          <LoginForm login={props.login} resend={props.resend} navigate={props.navigate} />
        </> : <>
          <div className="settings-section-heading"><h2>站点账号</h2><span className="settings-status">已登录</span></div>
          <dl className="settings-details"><div><dt>昵称</dt><dd>{props.account?.display_name || props.displayName}</dd></div><div><dt>邮箱</dt><dd>{props.account?.email || props.email}</dd></div></dl>
          <Button variant="outline" onClick={() => props.navigate('/me')}>我的关注</Button>
          <div className="settings-binding">
            <div><h2>洛谷账号</h2><p className="archive-muted">{props.loading ? '正在加载…' : props.account?.luogu_uid ? `UID ${props.account.luogu_uid}` : props.account ? '未绑定' : '账号信息暂不可用'}</p></div>
            {props.account && (props.account.luogu_uid ? <Button variant="outline" onClick={() => props.navigate(`/user/${props.account!.luogu_uid}`)}>查看用户</Button> : <BindingDialog challenge={props.challenge} verify={props.verify} />)}
          </div>
          {props.error && <div className="settings-message" role="alert"><p className="archive-error">{props.error}</p>{!props.account && <Button variant="outline" disabled={props.loading} onClick={props.retry}>重试</Button>}</div>}
          <Button variant="outline" disabled={props.loggingOut} onClick={props.logout}><LogOut size={16} aria-hidden="true" />{props.loggingOut ? '正在退出…' : '退出登录'}</Button>
        </>}
      </TabsContent>
      <TabsContent value="appearance">
        <div className="settings-section-heading"><h2>主题</h2></div>
        <RadioGroup value={props.theme} onValueChange={props.changeTheme} aria-label="主题模式" className="settings-themes">
          {themes.map(theme => <Label key={theme.value} className="settings-theme" htmlFor={`settings-theme-${theme.value}`} data-selected={props.theme === theme.value}>
            <RadioGroupItem id={`settings-theme-${theme.value}`} value={theme.value} /><theme.icon size={20} aria-hidden="true" /><span>{theme.label}</span>
          </Label>)}
        </RadioGroup>
      </TabsContent>
    </Tabs>
  </div>
}
