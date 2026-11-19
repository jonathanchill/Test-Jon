import type { VideoInfo } from './types'

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

/** Median views across the sampled recent videos that have a public view count. */
export function medianViews(videos: VideoInfo[]): number | null {
  return median(videos.map(v => v.views).filter((v): v is number => typeof v === 'number'))
}

/**
 * Posts per month, measured from the oldest sampled video to today, so a
 * channel that has stopped posting shows a falling rate, not its old one.
 */
export function postsPerMonth(dates: (string | null)[], now = new Date()): number | null {
  const times = dates.filter((d): d is string => Boolean(d)).map(d => Date.parse(d)).filter(Number.isFinite)
  if (times.length === 0) return null
  const days = Math.max(1, (now.getTime() - Math.min(...times)) / 86_400_000)
  return Math.round((times.length / days) * 30.44 * 10) / 10
}

export function lastPostAt(dates: (string | null)[]): string | null {
  const times = dates.filter((d): d is string => Boolean(d)).map(d => Date.parse(d)).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

export const FOLLOWER_BANDS = [
  { key: 'under_10k', label: 'Under 10,000', min: 0, max: 9_999 },
  { key: '10k_50k', label: '10,000 to 50,000', min: 10_000, max: 49_999 },
  { key: '50k_250k', label: '50,000 to 250,000', min: 50_000, max: 249_999 },
  { key: '250k_1m', label: '250,000 to 1 million', min: 250_000, max: 999_999 },
  { key: 'over_1m', label: 'Over 1 million', min: 1_000_000, max: Number.MAX_SAFE_INTEGER },
] as const

export type BandKey = typeof FOLLOWER_BANDS[number]['key']

export function followerBand(followers: number | null | undefined): typeof FOLLOWER_BANDS[number] | null {
  if (followers == null) return null
  return FOLLOWER_BANDS.find(b => followers >= b.min && followers <= b.max) ?? null
}
