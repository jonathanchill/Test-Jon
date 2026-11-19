import { createHash } from 'node:crypto'
import type { Brief } from './types'

// Rule 6: gambling and casino content is excluded. This list is the safety net
// that works even when Claude is unavailable. A match by itself only blocks
// approval until a person has looked; Claude's reading decides in normal runs.

// Phrases that mean gambling whenever they appear: one is enough.
const GAMBLING_CLEAR = [
  /\bonline\s+casinos?\b/i, /\bcasino\s+(?:bonus|wins?|stream|review|en\s+ligne)\b/i, /\bcrypto\s+casino\b/i,
  /\bsports?\s?bet(?:s|ting)\b/i, /\bbetting\s+(?:tips?|picks?|odds|strategy)\b/i, /\bfree\s+bets?\b/i,
  /\bonline\s+slots?\b/i, /\bslots?\s+(?:wins?|bonus|stream|session|jackpot)\b/i, /\bbonus\s+hunt\b/i,
  /\bbookmakers?\b/i, /\bparis?\s+sportifs?\b/i, /\bmachines?\s+à\s+sous\b/i, /\bjeux\s+d['’]argent\b/i,
  /\bpronos?(?:tics?)?\s+(?:foot|sportifs?|paris)\b/i, /\bstake\.com\b/i,
  /\b(?:roulette|blackjack)\s+strategy\b/i, /\bstratégie\s+roulette\b/i,
]

// Words that are often innocent ("a gamble", "Russian roulette", repairing a
// slot machine). They count only when they keep coming up across a channel.
const GAMBLING_LOOSE = [/\bcasinos?\b/i, /\bgambl(?:e|es|ed|ing|ers?)\b/i, /\broulette\b/i, /\bblackjack\b/i, /\bslot\s+machines?\b/i, /\bjackpots?\b/i]
const LOOSE_TEXTS_NEEDED = 3

/**
 * Gambling terms found across a channel's name, description and titles (pass
 * each as its own text). Empty unless there is a clear phrase, or loose words
 * in at least three separate texts.
 */
export function gamblingSignals(texts: (string | null | undefined)[]): string[] {
  const clear = new Set<string>()
  const loose = new Set<string>()
  let looseTexts = 0
  for (const text of texts) {
    if (!text) continue
    for (const re of GAMBLING_CLEAR) {
      const m = text.match(re)
      if (m) clear.add(m[0].toLowerCase())
    }
    const hits = GAMBLING_LOOSE.map(re => text.match(re)?.[0].toLowerCase()).filter((h): h is string => Boolean(h))
    if (hits.length) {
      looseTexts++
      for (const h of hits) loose.add(h)
    }
  }
  if (clear.size) return [...clear]
  return looseTexts >= LOOSE_TEXTS_NEEDED ? [...loose] : []
}

/** Warnings worked out from the numbers alone, before Claude reads anything. */
export function numericWarnings(a: { followers: number | null, medianViews: number | null, postsPerMonth: number | null, lastPostAt: string | null, madeForKids: boolean | null, videosSampled: number }, now = new Date()): string[] {
  const out: string[] = []
  if (a.followers && a.medianViews != null && a.videosSampled >= 5 && a.medianViews < a.followers * 0.01) {
    out.push(`Recent views are far below the follower count (median ${a.medianViews.toLocaleString('en-GB')} against ${a.followers.toLocaleString('en-GB')} followers)`)
  }
  if (a.lastPostAt && now.getTime() - Date.parse(a.lastPostAt) > 90 * 86_400_000) {
    out.push('No upload in the last 90 days')
  }
  if (a.videosSampled > 0 && a.videosSampled < 5) out.push(`Only ${a.videosSampled} recent videos to judge from`)
  if (a.madeForKids) out.push('Channel or recent videos are marked as made for kids')
  return out
}

function norm(s: string): string {
  return s.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/^youtube\.com\//, '').replace(/^@/, '').replace(/\/+$/, '').trim()
}

/** True when a creator is on the brief's leave-out list (by name, handle, channel id or channel link). */
export function isExcludedByBrief(brief: Pick<Brief, 'exclusions'>, c: { name: string, handle: string | null, platformId: string | null }): boolean {
  const wanted = new Set(brief.exclusions.map(norm).filter(Boolean))
  if (wanted.size === 0) return false
  const mine = [c.name, c.handle, c.platformId, c.handle ? `@${c.handle}` : null, c.platformId ? `channel/${c.platformId}` : null]
    .filter((v): v is string => Boolean(v)).map(norm)
  return mine.some(v => wanted.has(v))
}

/** Deleted creators are remembered only as a hash, so they are not found again. */
export function suppressionHash(platform: string, platformId: string): string {
  return createHash('sha256').update(`${platform}:${platformId}`).digest('hex')
}
