import * as React from 'react'
import { Download, Upload, Link, Plus, Minus, RotateCcw, Save, X, LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { applyTheme, defaultTheme, normalizeTheme, parseThemeId, prepareTheme, readTheme, saveTheme, type SavedTheme, type ThemeResult, type ThemeConfig } from '../utils/luoguTheme'

export interface ThemeEditorProps {
  resolvedTheme: string
  importTheme: (id: number, refresh: boolean, signal: AbortSignal) => Promise<ThemeResult>
  getTheme: (id: number, signal: AbortSignal) => Promise<ThemeResult>
}
const copy = (value: SavedTheme): SavedTheme => JSON.parse(JSON.stringify(value))
function Choice({ label, value, options, change }: { label: string; value: string; options: [string, string][]; change: (value: string) => void }) {
  const id = React.useId()
  return <div className="theme-field"><Label id={id}>{label}</Label><RadioGroup aria-labelledby={id} className="theme-choices" value={value} onValueChange={change}>
    {options.map(([key, name]) => <Label key={key} className="theme-choice" htmlFor={`${id}-${key}`}><RadioGroupItem id={`${id}-${key}`} value={key} />{name}</Label>)}
  </RadioGroup></div>
}
function Color({ label, value, change, remove }: { label: string; value: string; change: (value: string) => void; remove?: () => void }) {
  const id = React.useId()
  const [text, setText] = React.useState(value)
  const [invalid, setInvalid] = React.useState(false)
  React.useEffect(() => { setText(value); setInvalid(false) }, [value])
  function commit(value: string) {
    try { normalizeTheme({ lNavi: { back: value } }); change(value); setInvalid(false) }
    catch { setInvalid(true) }
  }
  return <div className="theme-field"><Label htmlFor={id}>{label}</Label><div className="theme-color-row">
    <Input type="color" aria-label={`${label}色板`} className="theme-swatch" value={/^#[\da-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={event => { setText(event.target.value); commit(event.target.value) }} />
    <Input id={id} aria-invalid={invalid} value={text} onChange={event => { setText(event.target.value); try { normalizeTheme({ lNavi: { back: event.target.value } }); change(event.target.value); setInvalid(false) } catch { setInvalid(true) } }} onBlur={() => commit(text)} />
    {remove && <Button type="button" size="icon" variant="ghost" title={`移除${label}`} aria-label={`移除${label}`} onClick={remove}><Minus size={16} /></Button>}
  </div>{invalid && <span className="archive-error">颜色格式不正确</span>}</div>
}
function Range({ label, value, min = 0, max = 100, unit = '%', change }: { label: string; value: number; min?: number; max?: number; unit?: string; change: (value: number) => void }) {
  const id = React.useId()
  return <div className="theme-field"><Label id={id}>{label}（{value}{unit}）</Label><Slider aria-labelledby={id} value={[value]} min={min} max={max} step={1} onValueChange={values => change(values[0])} /></div>
}
export function ThemeEditor(props: ThemeEditorProps) {
  const [draft, setDraft] = React.useState<SavedTheme>(readTheme)
  const baseline = React.useRef(JSON.stringify(draft))
  const [link, setLink] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [imageFallback, setImageFallback] = React.useState<SavedTheme | null>(null)
  const [preparedImage, setPreparedImage] = React.useState(draft.config.lBody.image)
  const [imageInput, setImageInput] = React.useState(draft.config.lBody.image)
  const [imageEnabled, setImageEnabled] = React.useState(Boolean(draft.config.lBody.image))
  const rememberedImage = React.useRef(draft.config.lBody.image)
  const file = React.useRef<HTMLInputElement>(null)
  const active = React.useRef(true)
  const operation = React.useRef<AbortController | null>(null)
  const dirty = JSON.stringify(draft) !== baseline.current
  const dark = props.resolvedTheme === 'dark'
  React.useEffect(() => () => { active.current = false; operation.current?.abort(); applyTheme(readTheme()) }, [])
  React.useEffect(() => {
    let cancelled = false
    if (!draft.enabled || !draft.config.lBody.image) { setPreparedImage(''); return }
    prepareTheme(draft).then(() => { if (!cancelled) setPreparedImage(draft.config.lBody.image) }).catch(reason => { if (!cancelled) setError(reason.message) })
    return () => { cancelled = true }
  }, [draft.enabled, draft.config.lBody.image])
  React.useEffect(() => {
    const preview = copy(draft)
    preview.config.lBody.image = preparedImage
    applyTheme(preview)
  }, [draft, preparedImage])
  function update(mutator: (theme: SavedTheme) => void) { setDraft(previous => { const next = copy(previous); mutator(next); return next }); setMessage(''); setError('') }
  function body<K extends keyof ThemeConfig['lBody']>(key: K, value: ThemeConfig['lBody'][K]) { update(theme => { theme.config.lBody[key] = value }) }
  function opts<K extends keyof ThemeConfig['lBody']['midOpts']>(key: K, value: ThemeConfig['lBody']['midOpts'][K]) { update(theme => { theme.config.lBody.midOpts[key] = value }) }
  function replace(next: SavedTheme) {
    setDraft(next); setImageInput(next.config.lBody.image); setImageEnabled(Boolean(next.config.lBody.image)); rememberedImage.current = next.config.lBody.image
  }
  async function importLink(refresh = false) {
    if (busy) return
    let id: number
    try { id = parseThemeId(link) } catch (reason) { setError((reason as Error).message); return }
    const controller = new AbortController(); operation.current = controller
    setBusy(true); setError(''); setImageFallback(null); setMessage('正在获取主题…')
    try {
      let result = await props.importTheme(id, refresh, controller.signal)
      const deadline = Date.now() + 900000
      while (result.status === 'pending') {
        if (Date.now() > deadline) throw Error('等待超时，请稍后重试')
        setMessage('主题抓取排队中…')
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
          const timer = window.setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve() }, 2000)
          controller.signal.addEventListener('abort', abort, { once: true })
          if (controller.signal.aborted) abort()
        })
        result = await props.getTheme(id, controller.signal)
      }
      if (result.status !== 'ready') throw Error(result.error || '主题导入失败')
      const next: SavedTheme = { name: result.name, config: normalizeTheme(result.config), enabled: true, sourceId: id, author: result.author_name }
      setMessage('正在加载主题背景…')
      try { await prepareTheme(next) }
      catch (reason) { if (active.current && !controller.signal.aborted) setImageFallback(next); throw reason }
      if (!active.current || controller.signal.aborted) return
      setPreparedImage(next.config.lBody.image); replace(next); applyTheme(next)
      setMessage(`已导入：${next.name}`)
    } catch (reason: any) { if (active.current) { if (reason.name !== 'AbortError') setError(reason?.data?.message || reason.message || '主题导入失败'); setMessage(reason.name === 'AbortError' ? '已取消等待' : '') } }
    finally { if (operation.current === controller) operation.current = null; if (active.current) setBusy(false) }
  }
  async function save() {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await prepareTheme(draft)
      if (!active.current) return
      saveTheme(draft); baseline.current = JSON.stringify(draft); setPreparedImage(draft.config.lBody.image); setMessage('主题已保存')
    } catch (reason: any) { if (active.current) setError(reason.message || '保存失败，浏览器存储可能不可用') }
    finally { if (active.current) setBusy(false) }
  }
  async function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; event.target.value = ''
    if (!selected || busy) return
    setError(''); setMessage(''); setBusy(true)
    try {
      if (selected.size > 65536) throw Error('主题文件不能超过 64KB')
      const raw = JSON.parse(await selected.text())
      const next = { name: String(raw.name || '导入主题').slice(0, 100), config: normalizeTheme(raw.config ?? raw), enabled: true }
      await prepareTheme(next)
      if (!active.current) return
      setPreparedImage(next.config.lBody.image); replace(next); setMessage('JSON 已导入')
    } catch (reason: any) { if (active.current) setError(reason.message || 'JSON 导入失败') }
    finally { if (active.current) setBusy(false) }
  }
  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: draft.name, config: draft.config }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'luogu-theme.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const config = draft.config, b = config.lBody, o = b.midOpts
  return <section className="theme-editor" aria-label="洛谷主题编辑">
    {dark ? <p className="archive-muted">暗色模式使用纯色背景，切换到亮色模式后可编辑主题。</p> : <>
      <div className="settings-section-heading"><h2>亮色主题</h2><div className="theme-choice"><Label htmlFor="theme-enabled">启用主题</Label><Switch id="theme-enabled" checked={draft.enabled} disabled={busy} onCheckedChange={value => update(theme => { theme.enabled = value })} /></div></div>
      <form className="theme-import" onSubmit={event => { event.preventDefault(); void importLink() }}>
        <Label htmlFor="theme-link">洛谷主题链接</Label><div className="theme-import-row"><Input id="theme-link" type="url" value={link} onChange={event => setLink(event.target.value)} placeholder="https://www.luogu.com.cn/theme/design/7" disabled={busy} required /><Button type="submit" disabled={busy}><Link size={16} />导入</Button><Button type="button" variant="outline" disabled={busy || !link} onClick={() => importLink(true)} title="重新抓取洛谷最新配置"><RotateCcw size={16} />重新导入</Button></div>
      </form>
      <div className="theme-feedback" aria-live="polite">{busy && <LoaderCircle className="settings-spin" size={16} />}{message && <span role="status">{message}</span>}{error && <span role="alert" className="archive-error">{error}</span>}{busy && operation.current && <Button variant="ghost" size="sm" onClick={() => operation.current?.abort()}>取消等待</Button>}</div>
      {imageFallback && <Button variant="outline" disabled={busy} onClick={() => { const next = copy(imageFallback); next.config.lBody.image = ''; setPreparedImage(''); replace(next); applyTheme(next); setImageFallback(null); setError(''); setMessage(`已导入：${next.name}（不使用背景图片）`) }}>不使用背景图片导入</Button>}
      <fieldset disabled={busy} className="theme-editor-panel">
        <div className="theme-field"><Label htmlFor="theme-name">主题名称</Label><Input id="theme-name" maxLength={100} value={draft.name} onChange={event => update(theme => { theme.name = event.target.value })} />{draft.author && <span className="archive-muted">原主题作者：{draft.author}</span>}</div>
        <h3>亮色导航</h3><div className="theme-grid theme-grid-three">
          <Color label="导航背景" value={config.lNavi.back} change={value => update(theme => { theme.config.lNavi.back = value })} />
          <Color label="文字颜色" value={config.lNavi.fore} change={value => update(theme => { theme.config.lNavi.fore = value })} />
          <div className="theme-logo-controls"><Choice label="Logo 颜色" value={config.lNavi.logo ? 'custom' : 'color'} options={[["color", "彩色"], ["custom", "自定义"]]} change={value => update(theme => { theme.config.lNavi.logo = value === 'custom' ? '#ffffff' : null })} />{config.lNavi.logo && <Color label="Logo 自定义颜色" value={config.lNavi.logo} change={value => update(theme => { theme.config.lNavi.logo = value })} />}</div>
        </div>
        <h3>亮色主体</h3><div className="theme-grid">
          <Color label="背景底色" value={b.back} change={value => body('back', value)} />
          <div className="theme-field"><Label>中景颜色</Label><div className="theme-color-list">{b.color.map((value, index) => <Color key={index} label={`颜色 ${index + 1}`} value={value} change={value => body('color', b.color.map((old, i) => i === index ? value : old))} remove={() => body('color', b.color.filter((_, i) => i !== index))} />)}</div><div className="theme-actions"><Button type="button" variant="outline" size="icon" aria-label="增加中景颜色" title="增加中景颜色" disabled={b.color.length >= 20} onClick={() => body('color', [...b.color, '#ffffff'])}><Plus size={16} /></Button><Button type="button" variant="outline" size="icon" aria-label="移除最后一个中景颜色" title="移除最后一个中景颜色" disabled={!b.color.length} onClick={() => body('color', b.color.slice(0, -1))}><Minus size={16} /></Button></div></div>
          <Range label="渐变角度" value={o.degree} max={360} unit="°" change={value => opts('degree', value)} />
          <Choice label="中景淡出" value={String(b.fade)} options={[["1", "从上淡出"], ["-1", "从下淡出"], ["0", "全屏"]]} change={value => body('fade', Number(value))} />
          <Range label="中景亮度" value={o.brightness} min={-100} change={value => opts('brightness', value)} />
          <Choice label="卡片毛玻璃" value={String(b.blur)} options={[["0", "关闭"], ["1000", "标准"], ["1010", "轻量"]]} change={value => body('blur', Number(value) as 0 | 1000 | 1010)} />
          <div className="theme-field theme-full"><div className="theme-choice"><Label htmlFor="theme-image-enabled">中景图片</Label><Switch id="theme-image-enabled" checked={imageEnabled} onCheckedChange={value => { setImageEnabled(value); body('image', value ? rememberedImage.current : '') }} /></div><div className="theme-import-row"><Input aria-label="中景图片地址" type="url" disabled={!imageEnabled} value={imageInput} placeholder="https://…/{d}.png" onChange={event => setImageInput(event.target.value)} onBlur={() => { try { const value = imageInput.trim(); normalizeTheme({ lBody: { image: value } }); rememberedImage.current = value; body('image', imageEnabled ? value : '') } catch (reason: any) { setError(reason.message) } }} /><Button type="button" variant="outline" onClick={() => { rememberedImage.current = ''; setImageInput(''); body('image', '') }}>清除</Button></div><span className="archive-muted">支持 {'{y}/{m}/{d}/{w}'} 年／月／日／星期占位符。外部图片由浏览器加载。</span></div>
          <Choice label="图片重复" value={o.repeat} options={[["none", "不重复"], ["all", "全部重复"], ["x", "横向重复"], ["y", "纵向重复"]]} change={value => opts('repeat', value)} />
          <div className="theme-field"><Choice label="图片尺寸" value={['auto', 'cover', 'contain'].includes(o.size) ? o.size : 'custom'} options={[["auto", "自动"], ["cover", "填充"], ["contain", "适应"], ["custom", "自定义"]]} change={value => opts('size', value === 'custom' ? '100 0' : value)} />{!['auto', 'cover', 'contain'].includes(o.size) && <div className="theme-size-fields">{[0, 1].map(index => <div className="theme-field" key={index}><Label htmlFor={`theme-size-${index}`}>{index ? '高度' : '宽度'}（%，0 为自动）</Label><Input id={`theme-size-${index}`} type="number" min={0} max={9999} value={o.size.split(/\s+/)[index] || '0'} onChange={event => { const size = o.size.split(/\s+/); size[index] = String(Math.max(0, Math.min(9999, Number(event.target.value)))); opts('size', `${size[0] || '0'} ${size[1] || '0'}`) }} /></div>)}</div>}</div>
          <Range label="图片位置 X" value={o.position[0]} change={value => opts('position', [value, o.position[1]])} />
          <Range label="图片位置 Y" value={o.position[1]} change={value => opts('position', [o.position[0], value])} />
        </div>
      </fieldset>
      <div className="theme-editor-footer"><div className="theme-actions"><Button disabled={busy || !dirty} onClick={save}><Save size={16} />保存主题</Button><Button variant="outline" disabled={busy || !dirty} onClick={() => { const saved = readTheme(); baseline.current = JSON.stringify(saved); replace(saved); setPreparedImage(saved.config.lBody.image); applyTheme(saved); setMessage('已取消修改'); setError(''); setImageFallback(null) }}><X size={16} />取消</Button><Button variant="outline" disabled={busy} onClick={() => { replace(defaultTheme()); setMessage(''); setError(''); setImageFallback(null) }}><RotateCcw size={16} />恢复默认</Button></div><div className="theme-actions"><input ref={file} type="file" accept=".json,application/json" hidden onChange={importJson} /><Button variant="outline" disabled={busy} onClick={() => file.current?.click()}><Upload size={16} />导入 JSON</Button><Button variant="outline" disabled={busy} onClick={exportJson}><Download size={16} />导出 JSON</Button></div></div>
    </>}
  </section>
}
