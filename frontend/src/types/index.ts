export interface User {
  id: string
  name: string
  email: string
}

export type OrganizationStatus = 'pending' | 'parsing' | 'ready' | 'blocked_retry' | 'failed'

export interface Organization {
  id: string
  url: string
  name: string | null
  avg_rating: number | null
  ratings_count: number | null
  reviews_count: number | null
  status: OrganizationStatus
  status_message: string
  error_message: string | null
  progress_current: number | null
  progress_total: number | null
  last_parsed_at: string | null
}

export interface Review {
  id: string
  author_name: string
  author_avatar_url: string | null
  rating: number | null
  text: string
  published_at: string | null
}

export interface OrganizationSnapshot {
  id: string
  avg_rating: number | null
  ratings_count: number | null
  reviews_count: number | null
  diff_summary: Record<string, { from: unknown; to: unknown }> | null
  captured_at: string
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}
