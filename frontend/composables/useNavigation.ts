import { computed, markRaw, type Component } from 'vue'
import {
  BookOpenCheck, ChartNoAxesCombined, FilePenLine, Gavel, House, Megaphone,
  MessageSquareText, MessagesSquare, Puzzle, ShieldAlert, Trophy,
} from 'lucide-vue-next'

export interface NavItem {
  to: string
  label: string
  icon: Component
  extended?: boolean
  primary?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export function useNavigation() {
  const config = useRuntimeConfig()
  const extended = computed(() => Boolean(config.public.extendedArchiveModulesEnabled))

  const items = computed<NavItem[]>(() => {
    const list: NavItem[] = [
      { to: '/', label: '首页', icon: markRaw(House), primary: true },
      { to: '/discuss', label: '讨论', icon: markRaw(MessagesSquare), primary: true },
      { to: '/judgement', label: '陶片放逐', icon: markRaw(Gavel), primary: true },
      { to: '/plugin', label: '插件', icon: markRaw(Puzzle), primary: true },
      { to: '/solution/fix', label: '题解修', icon: markRaw(FilePenLine), primary: true },
      { to: '/site/overview', label: '站点概览', icon: markRaw(ChartNoAxesCombined), primary: true },
    ]
    if (extended.value) {
      list.splice(1, 0, { to: '/feed', label: '伪全网犇', icon: markRaw(MessageSquareText), extended: true, primary: true })
      list.push(
        { to: '/problem/list', label: '题目', icon: markRaw(BookOpenCheck), extended: true, primary: true },
        { to: '/contest', label: '比赛', icon: markRaw(Trophy), extended: true, primary: true },
      )
    }
    return list
  })

  const groups = computed<NavGroup[]>(() => {
    return [
      { label: '浏览', items: items.value },
      {
        label: '关于',
        items: [
          { to: '/announcement', label: '站点公告', icon: markRaw(Megaphone) },
          { to: '/takedown', label: '侵权投诉', icon: markRaw(ShieldAlert) },
        ],
      },
    ]
  })

  const bottomItems = computed(() => [
    items.value[0],
    items.value.find(item => item.to === '/discuss'),
    items.value.find(item => item.to === '/judgement'),
    items.value.find(item => item.to === '/plugin'),
  ].filter(Boolean) as NavItem[])

  function isActive(path: string, to: string) {
    if (to === '/') return path === '/'
    return path === to || path.startsWith(to + '/')
  }

  return { items, groups, bottomItems, extended, isActive }
}
