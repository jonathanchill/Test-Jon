import type { Pool } from 'pg'
import type { Config } from './config'
import { reserve } from './quota'
import { suppressionHash } from './rules'
import type { Brief, YouTubeClient } from './types'
import { YOUTUBE_COST } from './youtube'

// Adding creators by hand. Instagram and TikTok have no free search, so
// creators found by a person (in TikTok One, Instagram's creator marketplace,
// or anywhere else) are pasted in and join the same list, review and export.

export type ManualPlatform = 'youtube' | 'instagram' | 'tiktok'

export interface ManualEntry {
  platform: ManualPlatform
  handle: string | null
  channelId: string | null
  line: string
}

export interface ManualResult { line: string, outcome: 'added' | 'already on this brief' | 'not found' | 'skipped', detail?: string }

const HANDLE = /^[A-Za-z0-9._-]{2,40}$/

/** Reads one handle or link per line. A bare handle is taken to be on `fallback`. */
export function parseManualEntries(text: string, fallback: ManualPlatform): { entries: ManualEntry[], invalid: string[] } {
  const entries: ManualEntry[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[\n,]+/)) {
    const line = raw.trim()
    if (!line) continue
    let entry: ManualEntry | null = null
    const yt = line.match(/youtube\.com\/(?:channel\/(UC[\w-]{20,})|@([\w.-]+))/i)
    const ig = line.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
    const tt = line.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i)
    if (yt) entry = { platform: 'youtube', channelId: yt[1] ?? null, handle: yt[2] ?? null, line }
    else if (ig) entry = { platform: 'instagram', handle: ig[1]!.toLowerCase(), channelId: null, line }
    else if (tt) entry = { platform: 'tiktok', handle: tt[1]!.toLowerCase(), channelId: null, line }
    else if (/^UC[\w-]{20,}$/.test(line) && fallback === 'youtube') entry = { platform: 'youtube', channelId: line, handle: null, line }
    else {
      const handle = line.replace(/^@/, '')
      if (HANDLE.test(handle) && !line.includes('/')) entry = { platform: fallback, handle: fallback === 'youtube' ? handle : handle.toLowerCase(), channelId: null, line }
    }
    if (!entry) { invalid.push(line); continue }
    const key = `${entry.platform}:${(entry.channelId ?? entry.handle ?? '').toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(entry)
  }
  return { entries, invalid }
}

const URLS: Record<Exclude<ManualPlatform, 'youtube'>, (h: string) => string> = {
  instagram: h => `https://www.instagram.com/${h}/`,
  tiktok: h => `https://www.tiktok.com/@${h}`,
}

export async function addManualCreators(
  { db, config, youtube }: { db: Pool, config: Config, youtube: YouTubeClient | null },
  brief: Brief, entries: ManualEntry[], who: string,
): Promise<ManualResult[]> {
  const results: ManualResult[] = []
  const suppressed = async (platform: string, id: string) =>
    Boolean((await db.query('select 1 from suppressions where platform = $1 and id_hash = $2', [platform, suppressionHash(platform, id)])).rowCount)

  /** Puts a creator on the brief. YouTube creators start at "found" so their numbers are pulled like any other. */
  const attach = async (creatorId: number, stage: 'found' | 'checked', line: string) => {
    const res = await db.query(
      `insert into brief_creators (brief_id, creator_id, stage, added_by) values ($1, $2, $3, $4) on conflict do nothing`,
      [brief.id, creatorId, stage, who],
    )
    results.push({ line, outcome: res.rowCount ? 'added' : 'already on this brief' })
  }

  for (const e of entries) {
    if (e.platform === 'youtube') {
      let channelId = e.channelId
      let title = e.handle ? `@${e.handle}` : channelId!
      if (!channelId) {
        // A handle has to be turned into a channel id, which costs one lookup.
        if (!youtube) { results.push({ line: e.line, outcome: 'skipped', detail: 'The YouTube key is not set' }); continue }
        const { bucket, cost } = YOUTUBE_COST.channels
        if (!(await reserve(db, 'youtube', bucket, cost, config.youtubeUnitsDailyLimit))) {
          results.push({ line: e.line, outcome: 'skipped', detail: 'Today\'s YouTube lookup allowance is used up. Try again tomorrow.' })
          continue
        }
        const ch = await youtube.getChannelByHandle(e.handle!)
        if (!ch) { results.push({ line: e.line, outcome: 'not found', detail: 'YouTube has no channel with that handle' }); continue }
        channelId = ch.id
        title = ch.title || title
      }
      if (await suppressed('youtube', channelId)) { results.push({ line: e.line, outcome: 'skipped', detail: 'This creator asked to be removed' }); continue }
      const existing = await db.query(`select creator_id from accounts where platform = 'youtube' and platform_id = $1`, [channelId])
      let creatorId: number = existing.rows[0]?.creator_id
      if (!creatorId) {
        creatorId = (await db.query('insert into creators (name) values ($1) returning id', [title])).rows[0].id
        await db.query(
          `insert into accounts (creator_id, platform, platform_id, url, title, source, link_source) values ($1, 'youtube', $2, $3, $4, $5, 'Added by hand')`,
          [creatorId, channelId, `https://www.youtube.com/channel/${channelId}`, title, youtube?.source ?? 'Not checked yet'],
        )
      }
      await attach(creatorId, 'found', e.line)
      continue
    }

    const handle = e.handle!
    if (await suppressed(e.platform, handle)) { results.push({ line: e.line, outcome: 'skipped', detail: 'This creator asked to be removed' }); continue }
    const existing = await db.query(
      `select a.creator_id, exists (select 1 from accounts y where y.creator_id = a.creator_id and y.platform = 'youtube') as has_youtube
       from accounts a where a.platform = $1 and lower(a.handle) = $2`,
      [e.platform, handle],
    )
    if (existing.rowCount) {
      // Already known, for example linked from a YouTube channel: one creator, one record.
      await attach(existing.rows[0].creator_id, existing.rows[0].has_youtube ? 'found' : 'checked', e.line)
      continue
    }
    const creatorId = (await db.query('insert into creators (name) values ($1) returning id', [`@${handle}`])).rows[0].id
    await db.query(
      `insert into accounts (creator_id, platform, handle, url, check_status, source, link_source)
       values ($1, $2, $3, $4, 'unchecked', 'Not checked yet', 'Added by hand')`,
      [creatorId, e.platform, handle, URLS[e.platform](handle)],
    )
    await attach(creatorId, 'checked', e.line)
  }
  return results
}
