import { QuotaExceededError } from './types'

// Version 2: Instagram lookups through Meta's official Business Discovery API.
// It looks up a professional account by username. There is no search, so the
// usernames come from links creators publish on their YouTube channel.
//
// NOT YET RUN AGAINST THE LIVE API. It needs 1minus1's Meta app, an Instagram
// professional account and (possibly) app review. Until INSTAGRAM_ACCESS_TOKEN
// and INSTAGRAM_USER_ID are set, linked Instagram accounts stay "unchecked".

export interface InstagramProfile {
  username: string
  name: string | null
  biography: string | null
  followers: number | null
  mediaCount: number | null
  posts: { id: string, url: string | null, timestamp: string | null, likes: number | null, comments: number | null, views: number | null, caption: string | null }[]
}

export interface InstagramClient {
  readonly source: string
  /** Returns null when the username is not a professional account or does not exist. */
  lookup(username: string): Promise<InstagramProfile | null>
}

export function createInstagramClient(opts: { accessToken: string, userId: string, version: string }, fetchImpl: typeof fetch = fetch): InstagramClient {
  async function call(username: string, withViews: boolean): Promise<Response> {
    const media = `media.limit(20){id,permalink,timestamp,like_count,comments_count,caption${withViews ? ',view_count' : ''}}`
    const fields = `business_discovery.username(${username}){username,name,biography,followers_count,media_count,${media}}`
    const url = new URL(`https://graph.facebook.com/${opts.version}/${opts.userId}`)
    url.searchParams.set('fields', fields)
    return fetchImpl(url, { headers: { authorization: `Bearer ${opts.accessToken}`, accept: 'application/json' } })
  }

  return {
    source: 'Instagram Business Discovery API',
    async lookup(username) {
      if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return null
      let res = await call(username, true)
      // Older API versions do not know view_count; ask again without it.
      if (res.status === 400) {
        const body = await res.clone().json().catch(() => null) as any
        if (body?.error?.code === 100 && /view_count/.test(body?.error?.message ?? '')) res = await call(username, false)
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as any
        const code = body?.error?.code
        const sub = body?.error?.error_subcode
        if (code === 4 || code === 17 || code === 32 || code === 613) throw new QuotaExceededError(`Instagram API rate limit reached: ${body?.error?.message ?? res.status}`)
        // 110 / subcode 2207013: not a professional account, or no such user.
        if (code === 110 || sub === 2207013 || code === 24) return null
        throw new Error(`Instagram API: ${body?.error?.message ?? res.status}`)
      }
      const data = await res.json() as any
      const bd = data?.business_discovery
      if (!bd) return null
      return {
        username: bd.username ?? username,
        name: bd.name ?? null,
        biography: bd.biography ?? null,
        followers: typeof bd.followers_count === 'number' ? bd.followers_count : null,
        mediaCount: typeof bd.media_count === 'number' ? bd.media_count : null,
        posts: (bd.media?.data ?? []).map((m: any) => ({
          id: String(m.id),
          url: m.permalink ?? null,
          timestamp: m.timestamp ?? null,
          likes: typeof m.like_count === 'number' ? m.like_count : null,
          comments: typeof m.comments_count === 'number' ? m.comments_count : null,
          views: typeof m.view_count === 'number' ? m.view_count : null,
          caption: typeof m.caption === 'string' ? m.caption.slice(0, 200) : null,
        })),
      }
    },
  }
}
