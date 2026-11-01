/**
 * 时间显示工具。后端存 UTC 字符串（含 Z 或 +00:00），前端统一转北京时间显示。
 *
 * 用法：
 *   const { format, fromNow, smart } = useTime()
 *   format(t)              // 2026-05-16 21:34
 *   format(t, 'MM-DD HH:mm')
 *   fromNow(t)             // 3 分钟前
 *   smart(t)               // 24h 内相对时间，否则绝对时间
 *
 * 注：dayjs 插件的注册放在本模块顶层，确保 SSR 和客户端两端都生效，
 *      不依赖 Nuxt plugin 的加载顺序。
 */
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 模块顶层注册插件，幂等
dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'Asia/Shanghai'

function toBJ(t: string | Date | number | null | undefined) {
  if (t == null || t === '') return null
  return dayjs.utc(t).tz(TZ)
}

export function useTime() {
  function format(t: any, fmt = 'YYYY-MM-DD HH:mm') {
    const d = toBJ(t)
    return d ? d.format(fmt) : ''
  }
  function relative(d: any) {
    const seconds = dayjs().tz(TZ).diff(d, 'second')
    if (seconds < 45) return '刚刚'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前`
    return d.format('YYYY-MM-DD HH:mm')
  }
  function fromNow(t: any) {
    const d = toBJ(t)
    return d ? relative(d) : ''
  }
  function smart(t: any) {
    const d = toBJ(t)
    if (!d) return ''
    const now = dayjs().tz(TZ)
    return now.diff(d, 'hour') < 24 ? relative(d) : d.format('YYYY-MM-DD HH:mm')
  }
  return { format, fromNow, smart, toBJ }
}
