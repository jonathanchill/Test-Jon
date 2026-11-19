import type { Pool, PoolClient } from 'pg'

export type Db = Pool | PoolClient

export interface Brief {
  id: number
  client: string
  name: string
  niches: string[]
  countries: string[]
  languages: string[]
  follower_min: number
  follower_max: number | null
  products: string[]
  exclusions: string[]
  notes: string
  status: 'draft' | 'running' | 'waiting_quota' | 'complete' | 'paused'
  status_note: string
  created_by: string
  created_at: string
}

export interface SearchRow {
  id: number
  brief_id: number
  kind: 'product' | 'niche'
  term: string
  niche: string | null
  region: string
  language: string
  status: 'queued' | 'done' | 'failed' | 'skipped'
  term_source: string
}

export interface RecentItem {
  id: string
  title: string
  url: string
  published_at: string | null
  views: number | null
}

export interface SearchHit {
  videoId: string
  channelId: string
  channelTitle: string
  title: string
  publishedAt: string | null
}

export interface ChannelInfo {
  id: string
  title: string
  description: string
  handle: string | null
  country: string | null
  defaultLanguage: string | null
  subscribers: number | null // null when the channel hides its count
  uploadsPlaylistId: string | null
  madeForKids: boolean | null
}

export interface VideoInfo {
  id: string
  title: string
  description: string
  publishedAt: string | null
  views: number | null
  language: string | null
  madeForKids: boolean | null
}

/** The only way the tool talks to YouTube. Implemented by the official Data API client and the demo fixture. */
export interface YouTubeClient {
  /** Label stored with every number, so a reader can see where it came from. */
  readonly source: string
  searchVideos(p: { q: string, regionCode: string, relevanceLanguage: string, maxResults: number }): Promise<SearchHit[]>
  getChannels(ids: string[]): Promise<ChannelInfo[]>
  /** Looks a channel up by its @handle. Costs the same as one getChannels call. */
  getChannelByHandle(handle: string): Promise<ChannelInfo | null>
  getRecentUploads(uploadsPlaylistId: string, max: number): Promise<VideoInfo[]>
}

export interface ScoreInput {
  brief: Brief
  channel: {
    platform: string
    name: string
    description: string
    declaredCountry: string | null
    declaredLanguage: string | null
    followers: number | null
    medianViews: number | null
    postsPerMonth: number | null
    madeForKids: boolean | null
  }
  recentTitles: string[]
  evidenceTitles: string[]
  /** Decisions a person has already made on this brief, so scoring follows their judgement. */
  examples?: ReviewedExample[]
}

export interface ReviewedExample {
  name: string
  recentTitles: string[]
  decision: 'approved' | 'shortlisted' | 'rejected' | 'score corrected'
  /** The score a person set by hand, if they changed it. */
  personScore: number | null
  personReason: string | null
  note: string | null
}

export interface ScoreResult {
  fit_score: number
  reason: string
  niches: string[]
  warnings: string[]
  gambling_or_casino: boolean
  creator_country_estimate: string | null
  creator_language_estimate: string | null
  estimate_note: string | null
}

export interface Scorer {
  readonly source: string
  score(input: ScoreInput): Promise<ScoreResult>
}

export interface TermExpander {
  /** Search terms for one niche or product, written the way people search in that language. */
  expand(brief: Brief): Promise<{ kind: 'product' | 'niche', niche: string | null, language: string, term: string }[]>
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}
