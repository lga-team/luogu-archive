export interface RecentTask {
  id: number
  task_type: string
  target: string
  trigger: string
  status: string
  started_at: string
}
export interface SiteOverviewData {
  generated_at: string
  totals: { crawl_tasks: number; articles: number; pastes: number; feeds: number; judgements: number }
  queues: { key: string; label: string; size: number }[]
  recent_tasks: RecentTask[]
}
