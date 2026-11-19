// Reads the Instagram, TikTok and Twitch handles a creator lists themselves.
// The Data API does not return the link buttons on a channel's About tab, so
// these come from the channel description and recent video descriptions.

export interface LinkedHandle {
  platform: 'instagram' | 'tiktok' | 'twitch'
  handle: string
  url: string
}

const PATTERNS: { platform: LinkedHandle['platform'], re: RegExp, url: (h: string) => string }[] = [
  { platform: 'instagram', re: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi, url: h => `https://www.instagram.com/${h}/` },
  { platform: 'tiktok', re: /(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{2,24})/gi, url: h => `https://www.tiktok.com/@${h}` },
  { platform: 'twitch', re: /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]{4,25})/gi, url: h => `https://www.twitch.tv/${h}` },
]

// Paths that are pages of the site, not accounts.
const NOT_HANDLES = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'about', 'directory', 'videos', 'settings', 'subscriptions', 'share'])

export function extractLinkedHandles(texts: (string | null | undefined)[]): LinkedHandle[] {
  const counts = new Map<string, { link: LinkedHandle, n: number }>()
  for (const text of texts) {
    if (!text) continue
    for (const { platform, re, url } of PATTERNS) {
      for (const m of text.matchAll(re)) {
        const handle = m[1]!.replace(/[.]+$/, '').toLowerCase()
        if (!handle || NOT_HANDLES.has(handle)) continue
        const key = `${platform}:${handle}`
        const entry = counts.get(key) ?? { link: { platform, handle, url: url(handle) }, n: 0 }
        entry.n++
        counts.set(key, entry)
      }
    }
  }
  // A description can mention other people's accounts (a guest, a sponsor).
  // Keep the handle listed most often per platform: that is the creator's own.
  const best = new Map<string, { link: LinkedHandle, n: number }>()
  for (const entry of counts.values()) {
    const cur = best.get(entry.link.platform)
    if (!cur || entry.n > cur.n) best.set(entry.link.platform, entry)
  }
  return [...best.values()].map(e => e.link)
}
