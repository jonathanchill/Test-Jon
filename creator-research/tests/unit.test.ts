import { describe, expect, it } from 'vitest'
import { extractLinkedHandles } from '../server/lib/links'
import { followerBand, median, postsPerMonth } from '../server/lib/metrics'
import { buildPlan, languagesFor } from '../server/lib/plan'
import { quotaDay } from '../server/lib/quota'
import { gamblingSignals, isExcludedByBrief, numericWarnings } from '../server/lib/rules'
import type { Brief } from '../server/lib/types'

const brief = {
  id: 1, client: 'My Arcade', name: 'UK and France', niches: ['retro gaming', 'toys and gifting'], countries: ['GB', 'FR'], languages: ['en', 'fr'],
  follower_min: 10000, follower_max: null, products: ['Evercade', 'Arcade1Up'], exclusions: [], notes: '', status: 'draft', status_note: '', created_by: '', created_at: '',
} as Brief

describe('metrics', () => {
  it('takes the median, not the mean, so one viral video does not inflate it', () => {
    expect(median([100, 120, 90, 110, 5_000_000])).toBe(110)
    expect(median([10, 20])).toBe(15)
    expect(median([])).toBeNull()
  })
  it('measures posting rate up to today, so a dormant channel shows a low rate', () => {
    const now = new Date('2026-11-19T00:00:00Z')
    const weekly = Array.from({ length: 12 }, (_, i) => new Date(now.getTime() - (i * 7 + 1) * 86_400_000).toISOString())
    expect(postsPerMonth(weekly, now)).toBeGreaterThan(4)
    const old = weekly.map(d => new Date(Date.parse(d) - 400 * 86_400_000).toISOString())
    expect(postsPerMonth(old, now)).toBeLessThan(1)
  })
  it('puts followers in the right band', () => {
    expect(followerBand(49_999)?.key).toBe('10k_50k')
    expect(followerBand(50_000)?.key).toBe('50k_250k')
    expect(followerBand(null)).toBeNull()
  })
})

describe('links', () => {
  it('reads Instagram and TikTok handles from descriptions', () => {
    const links = extractLinkedHandles(['Insta: https://www.instagram.com/Pixel.Attic/ and tiktok.com/@pixelattic', 'more at instagram.com/pixel.attic'])
    expect(links).toContainEqual({ platform: 'instagram', handle: 'pixel.attic', url: 'https://www.instagram.com/pixel.attic/' })
    expect(links).toContainEqual({ platform: 'tiktok', handle: 'pixelattic', url: 'https://www.tiktok.com/@pixelattic' })
  })
  it('ignores post links and keeps the handle listed most often', () => {
    expect(extractLinkedHandles(['https://instagram.com/p/Cabc123/'])).toEqual([])
    const links = extractLinkedHandles(['instagram.com/guest', 'instagram.com/me', 'instagram.com/me'])
    expect(links.map(l => l.handle)).toEqual(['me'])
  })
})

describe('rules', () => {
  it('spots gambling in English and French but not arcade machines', () => {
    expect(gamblingSignals(['Huge win at the online casino'])).not.toEqual([])
    expect(gamblingSignals(['Gros gain aux machines à sous'])).not.toEqual([])
    expect(gamblingSignals(['Restoring a 1980s arcade machine', 'Slot car racing set review', 'Game Boy cartridge slot repair'])).toEqual([])
  })
  it('ignores a stray gambling word but catches a channel that keeps using them', () => {
    expect(gamblingSignals(['Fixing a 1970s slot machine', 'Game Boy repair', 'Was this eBay lot a gamble?'])).toEqual([])
    expect(gamblingSignals(['Tech roulette: I bought 5 mystery phones'])).toEqual([])
    expect(gamblingSignals(['Casino night vlog', 'My biggest gamble yet', 'Jackpot! Vegas roulette run'])).not.toEqual([])
    expect(gamblingSignals(['Retro arcade tour', 'Best betting tips for the weekend'])).toEqual(['betting tips'])
  })

  it('warns when views are far below followers', () => {
    const w = numericWarnings({ followers: 200_000, medianViews: 600, postsPerMonth: 4, lastPostAt: new Date().toISOString(), madeForKids: false, videosSampled: 15 })
    expect(w.join(' ')).toMatch(/far below/)
    expect(numericWarnings({ followers: 200_000, medianViews: 30_000, postsPerMonth: 4, lastPostAt: new Date().toISOString(), madeForKids: false, videosSampled: 15 })).toEqual([])
  })
  it('matches the leave-out list by name, handle or link', () => {
    const c = { name: 'Pixel Attic', handle: 'pixelattic', platformId: 'UC123' }
    expect(isExcludedByBrief({ exclusions: ['@PixelAttic'] }, c)).toBe(true)
    expect(isExcludedByBrief({ exclusions: ['https://www.youtube.com/channel/UC123'] }, c)).toBe(true)
    expect(isExcludedByBrief({ exclusions: ['Someone Else'] }, c)).toBe(false)
  })
})

describe('search plan', () => {
  it('runs product searches first, in each country\'s own language', () => {
    const plan = buildPlan(brief, [{ kind: 'niche', niche: 'retro gaming', language: 'fr', term: 'rétrogaming test' }])
    expect(plan[0]!.kind).toBe('product')
    expect(plan.findIndex(p => p.kind === 'niche')).toBeGreaterThan(plan.findLastIndex(p => p.kind === 'product'))
    expect(plan.filter(p => p.region === 'GB').every(p => p.language === 'en')).toBe(true)
    expect(plan.filter(p => p.region === 'FR').every(p => p.language === 'fr')).toBe(true)
    expect(plan.find(p => p.term === 'rétrogaming test')).toMatchObject({ region: 'FR', niche: 'retro gaming', term_source: 'claude' })
    expect(plan).toHaveLength(9) // (2 products + 2 niches) x 2 countries + 1 Claude term
  })
  it('searches every brief language in a country it does not know', () => {
    expect(languagesFor('BE', ['en', 'fr'])).toEqual(['fr'])
    expect(languagesFor('XX', ['en', 'fr'])).toEqual(['en', 'fr'])
  })
})

describe('quota day', () => {
  it('follows Pacific time for YouTube', () => {
    expect(quotaDay('youtube', new Date('2026-11-19T07:30:00Z'))).toBe('2026-11-18')
    expect(quotaDay('youtube', new Date('2026-11-19T08:30:00Z'))).toBe('2026-11-19')
  })
})
