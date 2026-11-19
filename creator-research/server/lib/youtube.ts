import { QuotaExceededError, type ChannelInfo, type SearchHit, type VideoInfo, type YouTubeClient } from './types'

const BASE = 'https://www.googleapis.com/youtube/v3'

/** What each call costs against the daily allowances. Kept next to the client so the two stay in step. */
export const YOUTUBE_COST = {
  search: { bucket: 'search', cost: 1 }, // searches have their own allowance
  channels: { bucket: 'units', cost: 1 }, // up to 50 channels per call
  recentUploads: { bucket: 'units', cost: 2 }, // playlistItems.list + videos.list
} as const

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** The official YouTube Data API v3, read-only, with an API key. */
export function createYouTubeClient(apiKey: string, fetchImpl: typeof fetch = fetch): YouTubeClient {
  async function get(path: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${BASE}/${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    // The key travels in a header, not the address, so it never ends up in logs of requested URLs.
    const res = await fetchImpl(url, { headers: { accept: 'application/json', 'x-goog-api-key': apiKey } })
    if (res.ok) return res.json()
    let reason = ''
    let message = `YouTube API ${path} returned ${res.status}`
    try {
      const body = await res.json() as any
      reason = body?.error?.errors?.[0]?.reason ?? ''
      if (body?.error?.message) message = `YouTube API ${path}: ${body.error.message}`
    } catch { /* keep the status message */ }
    if (res.status === 403 && /quota|dailyLimit|rateLimit/i.test(reason)) throw new QuotaExceededError(message)
    throw new Error(message)
  }

  const toChannel = (it: any): ChannelInfo => ({
    id: it.id,
    title: it.snippet?.title ?? '',
    description: it.snippet?.description ?? '',
    handle: typeof it.snippet?.customUrl === 'string' ? it.snippet.customUrl.replace(/^@/, '') : null,
    country: it.snippet?.country ?? null,
    defaultLanguage: it.snippet?.defaultLanguage ?? null,
    subscribers: it.statistics?.hiddenSubscriberCount ? null : num(it.statistics?.subscriberCount),
    uploadsPlaylistId: it.contentDetails?.relatedPlaylists?.uploads ?? null,
    madeForKids: typeof it.status?.madeForKids === 'boolean' ? it.status.madeForKids : null,
  })

  return {
    source: 'YouTube Data API v3',

    async searchVideos({ q, regionCode, relevanceLanguage, maxResults }): Promise<SearchHit[]> {
      const data = await get('search', {
        part: 'snippet', type: 'video', q, regionCode, relevanceLanguage,
        maxResults: String(maxResults), order: 'relevance', safeSearch: 'none',
      })
      return (data.items ?? [])
        .filter((it: any) => it?.id?.videoId && it?.snippet?.channelId)
        .map((it: any): SearchHit => ({
          videoId: it.id.videoId,
          channelId: it.snippet.channelId,
          channelTitle: it.snippet.channelTitle ?? '',
          title: it.snippet.title ?? '',
          publishedAt: it.snippet.publishedAt ?? null,
        }))
    },

    async getChannels(ids): Promise<ChannelInfo[]> {
      if (ids.length === 0) return []
      if (ids.length > 50) throw new Error('getChannels takes at most 50 ids per call')
      const data = await get('channels', { part: 'snippet,statistics,contentDetails,status', id: ids.join(','), maxResults: '50' })
      return (data.items ?? []).map(toChannel)
    },

    async getChannelByHandle(handle): Promise<ChannelInfo | null> {
      const data = await get('channels', { part: 'snippet,statistics,contentDetails,status', forHandle: `@${handle.replace(/^@/, '')}` })
      const item = (data.items ?? [])[0]
      return item ? toChannel(item) : null
    },

    async getRecentUploads(uploadsPlaylistId, max): Promise<VideoInfo[]> {
      let list: any
      try {
        list = await get('playlistItems', { part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: String(Math.min(50, max)) })
      } catch (err) {
        // A channel with no public uploads has no uploads playlist to read.
        if (err instanceof Error && !(err instanceof QuotaExceededError) && /playlist|404/i.test(err.message)) return []
        throw err
      }
      const ids: string[] = (list.items ?? []).map((it: any) => it?.contentDetails?.videoId).filter(Boolean)
      if (ids.length === 0) return []
      const data = await get('videos', { part: 'snippet,statistics,status', id: ids.join(','), maxResults: '50' })
      return (data.items ?? []).map((it: any): VideoInfo => ({
        id: it.id,
        title: it.snippet?.title ?? '',
        description: it.snippet?.description ?? '',
        publishedAt: it.snippet?.publishedAt ?? null,
        views: num(it.statistics?.viewCount),
        language: it.snippet?.defaultAudioLanguage ?? it.snippet?.defaultLanguage ?? null,
        madeForKids: typeof it.status?.madeForKids === 'boolean' ? it.status.madeForKids : null,
      }))
    },
  }
}
