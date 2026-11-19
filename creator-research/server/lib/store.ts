import { FOLLOWER_BANDS, followerBand, type BandKey } from './metrics'
import { suppressionHash } from './rules'
import type { Brief, Db } from './types'

export interface CreatorFilters {
  country?: string
  niche?: string
  band?: BandKey
  minScore?: number
  status?: string
  stage?: string // 'review' (default), 'out_of_range', 'not_checkable', 'left_out', 'all'
  q?: string
  ids?: number[]
}

export interface CreatorRow {
  creator_id: number
  name: string
  country: string | null
  country_source: string
  language: string | null
  language_source: string
  niches: string[]
  stage: string
  fit_score: number | null
  reason: string | null
  warnings: string[]
  estimate_note: string | null
  excluded_reason: string | null
  score_source: string | null
  score_error: string | null
  status: string
  review_note: string
  reviewed_by: string | null
  reviewed_at: string | null
  edited: boolean
  /** The account the row's numbers come from: YouTube where there is one, otherwise the largest checked account. */
  primary_platform: string
  primary_url: string
  added_by: string | null
  handle: string | null
  followers: number | null
  median_recent_views: number | null
  posts_per_month: number | null
  last_post_at: string | null
  checked_at: string | null
  source: string
  check_status: string
  band: string | null
  linked: { platform: string, handle: string, url: string, followers: number | null, check_status: string, source: string, checked_at: string | null }[]
  evidence_count: number
}

export async function listCreators(db: Db, briefId: number, f: CreatorFilters = {}): Promise<CreatorRow[]> {
  const where = ['bc.brief_id = $1']
  const params: unknown[] = [briefId]
  const p = (v: unknown) => { params.push(v); return `$${params.length}` }

  const stage = f.stage ?? 'review'
  if (stage === 'review') where.push(`bc.stage in ('checked', 'scored')`)
  else if (stage !== 'all') where.push(`bc.stage = ${p(stage)}`)
  if (f.country === 'unknown') where.push('c.country is null')
  else if (f.country) where.push(`c.country = ${p(f.country)}`)
  if (f.niche) where.push(`${p(f.niche)} = any(bc.niches)`)
  if (f.minScore) where.push(`bc.fit_score >= ${p(f.minScore)}`)
  if (f.status) where.push(`bc.status = ${p(f.status)}`)
  if (f.q) where.push(`(c.name ilike ${p(`%${f.q}%`)} or a.handle ilike ${p(`%${f.q}%`)})`)
  if (f.ids) where.push(`bc.creator_id = any(${p(f.ids)}::bigint[])`)
  if (f.band) {
    const band = FOLLOWER_BANDS.find(b => b.key === f.band)
    if (band) where.push(`a.followers between ${p(band.min)} and ${p(band.max)}`)
  }

  const res = await db.query(
    `select bc.creator_id, c.name, c.country, c.country_source, c.language, c.language_source,
            bc.niches, bc.stage, bc.fit_score, bc.reason, bc.warnings, bc.estimate_note, bc.excluded_reason,
            bc.score_source, bc.score_error, bc.status, bc.review_note, bc.reviewed_by, bc.reviewed_at, bc.edited,
            a.platform as primary_platform, a.url as primary_url, a.handle, bc.added_by, a.followers::float8 as followers, a.median_recent_views::float8 as median_recent_views,
            a.posts_per_month::float8 as posts_per_month, a.last_post_at, a.checked_at, a.source, a.check_status,
            (select count(*)::int from evidence e where e.brief_id = bc.brief_id and e.creator_id = bc.creator_id) as evidence_count,
            coalesce((select json_agg(json_build_object('platform', l.platform, 'handle', l.handle, 'url', l.url,
                        'followers', l.followers, 'check_status', l.check_status, 'source', l.source, 'checked_at', l.checked_at) order by l.platform)
                      from accounts l where l.creator_id = bc.creator_id and l.id <> a.id), '[]') as linked
     from brief_creators bc
     join creators c on c.id = bc.creator_id
     join lateral (
       select * from accounts x where x.creator_id = bc.creator_id
       order by (x.platform = 'youtube') desc, x.followers desc nulls last, x.id limit 1) a on true
     where ${where.join(' and ')}
     order by bc.fit_score desc nulls last, a.followers desc nulls last, c.name`,
    params,
  )
  return res.rows.map(r => ({ ...r, band: followerBand(r.followers)?.label ?? null }))
}

export async function creatorDetail(db: Db, briefId: number, creatorId: number) {
  const [row] = await listCreators(db, briefId, { stage: 'all', ids: [creatorId] })
  if (!row) return null
  const accounts = await db.query(
    `select id, platform, handle, url, title, description, followers::float8 as followers, median_recent_views::float8 as median_recent_views,
            videos_sampled, posts_per_month::float8 as posts_per_month, made_for_kids, last_post_at, recent_items, check_status, source, link_source, checked_at
     from accounts where creator_id = $1 order by (platform = 'youtube') desc, platform`,
    [creatorId],
  )
  const evidence = await db.query(
    `select e.title, e.url, e.published_at, e.found_at, s.term, s.kind, s.region, s.language
     from evidence e left join searches s on s.id = e.search_id
     where e.brief_id = $1 and e.creator_id = $2 order by (s.kind = 'product') desc, e.found_at`,
    [briefId, creatorId],
  )
  return { ...row, accounts: accounts.rows, evidence: evidence.rows }
}

export interface CountTable { label: string, rows: { key: string, byBand: Record<string, number>, total: number }[] }

/**
 * The real count: how many creators fit, by country, niche and follower band.
 * "Fit" means a fit score at or above `minScore` and not rejected or excluded.
 */
export async function briefCounts(db: Db, brief: Brief, minScore = 3) {
  const rows = await listCreators(db, brief.id, { stage: 'all' })
  const reviewable = rows.filter(r => r.stage === 'checked' || r.stage === 'scored')
  const fits = reviewable.filter(r => (r.fit_score ?? 0) >= minScore && r.status !== 'rejected' && !r.excluded_reason)

  const table = (label: string, keysOf: (r: CreatorRow) => string[]): CountTable => {
    const map = new Map<string, { key: string, byBand: Record<string, number>, total: number }>()
    for (const r of fits) {
      const band = followerBand(r.followers)?.key ?? 'unknown'
      for (const key of keysOf(r)) {
        const entry = map.get(key) ?? { key, byBand: {}, total: 0 }
        entry.byBand[band] = (entry.byBand[band] ?? 0) + 1
        entry.total++
        map.set(key, entry)
      }
    }
    return { label, rows: [...map.values()].sort((a, b) => b.total - a.total) }
  }

  const searches = (await db.query(
    `select count(*)::int as total, count(*) filter (where status = 'done')::int as done,
            count(*) filter (where status = 'queued')::int as queued, count(*) filter (where status = 'failed')::int as failed
     from searches where brief_id = $1`,
    [brief.id],
  )).rows[0]
  const unscored = reviewable.filter(r => r.fit_score == null)

  return {
    minScore,
    bands: FOLLOWER_BANDS.map(b => ({ key: b.key, label: b.label })),
    fit: fits.length,
    byCountry: table('Country', r => [r.country ? (r.country_source === 'estimate' ? `${r.country} (estimate)` : r.country) : 'Unknown']),
    // A creator who covers two niches is counted under both, so niche rows can add up to more than the total.
    byNiche: table('Niche', r => r.niches.length ? r.niches : ['No niche matched']),
    byScore: [5, 4, 3, 2, 1].map(score => ({ score, count: reviewable.filter(r => r.fit_score === score).length })),
    byStatus: ['found', 'shortlisted', 'approved', 'rejected'].map(status => ({ status, count: reviewable.filter(r => r.status === status).length })),
    funnel: {
      channelsFound: rows.length,
      waitingForNumbers: rows.filter(r => r.stage === 'found').length,
      outOfRange: rows.filter(r => r.stage === 'out_of_range').length,
      leftOut: rows.filter(r => r.stage === 'left_out').length,
      inRange: reviewable.length,
      scored: reviewable.length - unscored.length,
    },
    // What could not be checked, said plainly.
    notChecked: {
      noPublicNumbers: rows.filter(r => r.stage === 'not_checkable').length,
      notScored: unscored.length,
      scoreErrors: reviewable.filter(r => r.score_error).length,
      linkedAccountsUnchecked: reviewable.reduce((n, r) => n + r.linked.filter(l => l.check_status === 'unchecked').length, 0),
      countryUnknown: reviewable.filter(r => !r.country).length,
      countryEstimated: reviewable.filter(r => r.country_source === 'estimate').length,
      failedSearches: searches.failed,
    },
    searches,
  }
}

export async function audit(db: Db, actor: string, action: string, briefId: number | null, detail: Record<string, unknown> = {}) {
  await db.query('insert into audit_log (actor, action, brief_id, detail) values ($1, $2, $3, $4)', [actor, action, briefId, JSON.stringify(detail)])
}

/**
 * Rule 4: a creator can be deleted on request. Removes the creator and every
 * account, score and piece of evidence, and keeps only a hash so later
 * searches do not add them again.
 */
export async function deleteCreator(db: Db, creatorId: number, actor: string): Promise<boolean> {
  const accounts = await db.query('select platform, platform_id, handle from accounts where creator_id = $1', [creatorId])
  if (accounts.rowCount === 0 && (await db.query('select 1 from creators where id = $1', [creatorId])).rowCount === 0) return false
  for (const a of accounts.rows) {
    const id = a.platform_id ?? a.handle?.toLowerCase()
    if (id) await db.query('insert into suppressions (platform, id_hash) values ($1, $2) on conflict do nothing', [a.platform, suppressionHash(a.platform, id)])
  }
  await db.query('delete from creators where id = $1', [creatorId])
  // The log records that a deletion happened, not who was deleted.
  await audit(db, actor, 'creator.deleted_on_request', null, { accounts: accounts.rowCount })
  return true
}
