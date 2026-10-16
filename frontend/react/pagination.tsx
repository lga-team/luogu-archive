import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  pending?: boolean
  onPage: (page: number) => void
}

export function Pagination({ page, totalPages, pending, onPage }: PaginationProps) {
  const total = Math.max(1, totalPages)
  const current = Math.min(total, Math.max(1, page))
  const count = Math.min(10, total)
  const start = Math.max(1, Math.min(current - 5, total - count + 1))
  const pages = Array.from({ length: count }, (_, index) => start + index)
  const navigation = (target: number, label: string, icon: ReactNode, disabled: boolean) => (
    <Button type="button" variant="outline" size="icon" className="archive-page-button"
      aria-label={label} title={label} disabled={pending || disabled} onClick={() => onPage(target)}>
      {icon}
    </Button>
  )

  return <nav className="archive-pagination" aria-label="分页" aria-busy={pending}>
    <span className="archive-pagination-total" aria-live="polite">共 {total} 页</span>
    <div className="archive-pagination-pages">
      {navigation(1, '首页', <ChevronsLeft size={16} aria-hidden="true" />, current === 1)}
      {navigation(current - 1, '上一页', <ChevronLeft size={16} aria-hidden="true" />, current === 1)}
      {pages.map(number => <Button key={number} type="button" variant="outline" size="icon"
        className="archive-page-button" aria-label={`第 ${number} 页`}
        aria-current={number === current ? 'page' : undefined}
        disabled={pending} onClick={() => { if (number !== current) onPage(number) }}>
        {number}
      </Button>)}
      {navigation(current + 1, '下一页', <ChevronRight size={16} aria-hidden="true" />, current === total)}
      {navigation(total, '末页', <ChevronsRight size={16} aria-hidden="true" />, current === total)}
    </div>
  </nav>
}
