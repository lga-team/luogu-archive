const REQUEST_LEVELS = [
  { label: '无请求', className: 'level-0' },
  { label: '少请求', className: 'level-1' },
  { label: '中等请求', className: 'level-2' },
  { label: '较多请求', className: 'level-3' },
]

const RUNTIME_LABELS: Record<string, string> = {
  userscript: '用户脚本',
  extension: '浏览器扩展',
  bookmarklet: '书签脚本',
  other: '其他',
}

const REQUEST_LEVEL_COLORS: Record<number, string> = {
  0: 'var(--success)',
  1: 'var(--info)',
  2: 'var(--warning)',
  3: 'var(--destructive)',
}

export function usePluginLabels() {
  function requestLevel(level: number) {
    return REQUEST_LEVELS[level] || REQUEST_LEVELS[3]
  }

  function levelColor(level: number) {
    return REQUEST_LEVEL_COLORS[level] ?? REQUEST_LEVEL_COLORS[3]
  }

  function runtimeMode(value: string) {
    return RUNTIME_LABELS[value] || value
  }

  return { requestLevel, levelColor, runtimeMode, requestLevels: REQUEST_LEVELS, runtimeLabels: RUNTIME_LABELS }
}
