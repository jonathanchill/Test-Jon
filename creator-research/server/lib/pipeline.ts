import Anthropic from '@anthropic-ai/sdk'
import type { Pool } from 'pg'
import type { Config } from './config'
import type { InstagramClient } from './instagram'
import { extractLinkedHandles } from './links'
import { lastPostAt, median, medianViews, postsPerMonth } from './metrics'
import { markExhausted, reserve } from './quota'
import { gamblingSignals, isExcludedByBrief, numericWarnings, suppressionHash } from './rules'
import { QuotaExceededError, type Brief, type ChannelInfo, type RecentItem, type ReviewedExample, type Scorer, type SearchRow, type YouTubeClient } from './types'
import { YOUTUBE_COST } from './youtube'

// The run for one brief, in the order the scope sets out:
// product searches, niche searches, pull the numbers, follow the links, score.
// Each step does a small batch and returns, so a run can stop at a daily limit
// and pick up where it left off the next day.

export interface Deps {
  db: Pool
  config: Config
  youtube: YouTubeClient | null
  scorer: Scorer | null
  instagram: InstagramClient | null
  now?: () => Date
}

interface StepResult {
  worked: boolean // did something; call again
  blocked?: string // cannot continue for now, with the reason
}

const SEARCHES_PER_TICK = 5

async function setStatus(db: Pool, briefId: number, status: Brief['status'], note: string) {
  await db.query('update briefs set status = $2, status_note = $3, updated_at = now() where id = $1 and (status <> $2 or status_note <> $3)', [briefId, status, note])
}

// ---------- Step 1: searches ----------

async function runSearches({ db, config, youtube, now = () => new Date() }: Deps, brief: Brief): Promise<StepResult> {
  const queued = await db.query<SearchRow>(
    `select * from searches where brief_id = $1 and status = 'queued' and platform = 'youtube'
     order by (kind = 'product') desc, id limit $2`,
    [brief.id, SEARCHES_PER_TICK],
  )
  if (queued.rowCount === 0) return { worked: false }
  if (!youtube) return { worked: false, blocked: 'YOUTUBE_API_KEY is not set, so searches cannot run.' }

  let worked = false
  for (const search of queued.rows) {
    const { bucket, cost } = YOUTUBE_COST.search
    if (!(await reserve(db, 'youtube', bucket, cost, config.youtubeSearchDailyLimit, now()))) {
      return { worked, blocked: `Today's YouTube search limit (${config.youtubeSearchDailyLimit}) is used up. The remaining searches run after it resets at midnight Pacific time.` }
    }
    try {
      const hits = await youtube.searchVideos({ q: search.term, regionCode: search.region, relevanceLanguage: search.language, maxResults: config.youtubeResultsPerSearch })
      let fresh = 0
      const client = await db.connect()
      try {
        await client.query('begin')
        for (const hit of hits) {
          if (await recordHit(client, brief, search, hit, youtube.source)) fresh++
        }
        await client.query(`update searches set status = 'done', result_count = $2, new_channels = $3, run_at = now(), error = null where id = $1`, [search.id, hits.length, fresh])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw err
      } finally {
        client.release()
      }
      worked = true
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        await markExhausted(db, 'youtube', bucket, config.youtubeSearchDailyLimit, now())
        return { worked, blocked: 'YouTube says today\'s search allowance is used up. The remaining searches run after it resets at midnight Pacific time.' }
      }
      await db.query(`update searches set status = 'failed', error = $2, run_at = now() where id = $1`, [search.id, err instanceof Error ? err.message : String(err)])
      worked = true
    }
  }
  return { worked }
}

/** Stores one search result. Returns true when the channel is new to this brief. */
async function recordHit(db: import('pg').PoolClient, brief: Brief, search: SearchRow, hit: { videoId: string, channelId: string, channelTitle: string, title: string, publishedAt: string | null }, source: string): Promise<boolean> {
  const suppressed = await db.query('select 1 from suppressions where platform = $1 and id_hash = $2', ['youtube', suppressionHash('youtube', hit.channelId)])
  if (suppressed.rowCount) return false

  let creatorId: number
  const existing = await db.query('select creator_id from accounts where platform = $1 and platform_id = $2', ['youtube', hit.channelId])
  if (existing.rowCount) {
    creatorId = existing.rows[0].creator_id
  } else {
    const creator = await db.query('insert into creators (name) values ($1) returning id', [hit.channelTitle || hit.channelId])
    creatorId = creator.rows[0].id
    await db.query(
      `insert into accounts (creator_id, platform, platform_id, url, title, source) values ($1, 'youtube', $2, $3, $4, $5)`,
      [creatorId, hit.channelId, `https://www.youtube.com/channel/${hit.channelId}`, hit.channelTitle, source],
    )
  }

  const link = await db.query(
    `insert into brief_creators (brief_id, creator_id, niches) values ($1, $2, $3)
     on conflict (brief_id, creator_id) do update set niches = (
       select coalesce(array_agg(distinct n), '{}') from unnest(brief_creators.niches || excluded.niches) n)
     returning (xmax = 0) as inserted`,
    [brief.id, creatorId, search.niche ? [search.niche] : []],
  )
  await db.query(
    `insert into evidence (brief_id, creator_id, search_id, platform, item_id, url, title, published_at)
     values ($1, $2, $3, 'youtube', $4, $5, $6, $7) on conflict do nothing`,
    [brief.id, creatorId, search.id, hit.videoId, `https://www.youtube.com/watch?v=${hit.videoId}`, hit.title, hit.publishedAt],
  )
  return link.rows[0].inserted
}

// ---------- Step 2: numbers and links ----------

interface FoundRow {
  creator_id: number
  account_id: number
  platform_id: string
  handle: string | null
  title: string | null
  description: string | null
  followers: string | null
  check_status: string
  checked_at: Date | null
  uploads_ref: string | null
  videos_sampled: number | null
  made_for_kids: boolean | null
  creator_name: string
}

async function enrich(deps: Deps, brief: Brief): Promise<StepResult> {
  const { db, config, youtube, now = () => new Date() } = deps
  const load = () => db.query<FoundRow>(
    `select bc.creator_id, a.id as account_id, a.platform_id, a.handle, a.title, a.description, a.followers,
            a.check_status, a.checked_at, a.uploads_ref, a.videos_sampled, a.made_for_kids, c.name as creator_name
     from brief_creators bc
     join creators c on c.id = bc.creator_id
     join accounts a on a.creator_id = bc.creator_id and a.platform = 'youtube'
     where bc.brief_id = $1 and bc.stage = 'found'
     order by bc.created_at, bc.creator_id limit 50`,
    [brief.id],
  )
  let rows = (await load()).rows
  if (rows.length === 0) return { worked: false }
  if (!youtube) return { worked: false, blocked: 'YOUTUBE_API_KEY is not set, so channel numbers cannot be pulled.' }

  const outOfUnits = `Today's YouTube lookup allowance (${config.youtubeUnitsDailyLimit} units) is used up. Channel checks continue after it resets at midnight Pacific time.`
  const staleBefore = config.recheckDays > 0 ? now().getTime() - config.recheckDays * 86_400_000 : 0
  const stale = rows.filter(r => !r.checked_at || r.checked_at.getTime() < staleBefore)

  try {
    if (stale.length) {
      const { bucket, cost } = YOUTUBE_COST.channels
      if (!(await reserve(db, 'youtube', bucket, cost, config.youtubeUnitsDailyLimit, now()))) return { worked: false, blocked: outOfUnits }
      const channels = await youtube.getChannels(stale.map(r => r.platform_id))
      const byId = new Map(channels.map(c => [c.id, c]))
      for (const row of stale) {
        const ch = byId.get(row.platform_id)
        if (ch) await saveChannel(db, row, ch, youtube.source)
        else await db.query(`update accounts set check_status = 'not_found', checked_at = now() where id = $1`, [row.account_id])
      }
      rows = (await load()).rows
    }

    for (const row of rows) {
      const followers = row.followers == null ? null : Number(row.followers)
      const finish = (stage: string, extra = '', params: unknown[] = []) =>
        db.query(`update brief_creators set stage = $3 ${extra} where brief_id = $1 and creator_id = $2`, [brief.id, row.creator_id, stage, ...params])

      if (row.check_status === 'not_found') { await finish('not_checkable'); continue }
      if (isExcludedByBrief(brief, { name: row.creator_name, handle: row.handle, platformId: row.platform_id })) {
        await finish('left_out', `, status = 'rejected', review_note = 'On the brief''s leave-out list'`)
        continue
      }
      if (followers == null) { await finish('not_checkable'); continue }
      if (followers < brief.follower_min || (brief.follower_max != null && followers > brief.follower_max)) { await finish('out_of_range'); continue }

      let sampled = row.videos_sampled
      let texts: string[] = [row.description ?? '']
      if (sampled == null) {
        const { bucket, cost } = YOUTUBE_COST.recentUploads
        if (!(await reserve(db, 'youtube', bucket, cost, config.youtubeUnitsDailyLimit, now()))) return { worked: true, blocked: outOfUnits }
        const videos = row.uploads_ref ? await youtube.getRecentUploads(row.uploads_ref, config.recentVideoSample) : []
        videos.sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''))
        const dates = videos.map(v => v.publishedAt)
        const items: RecentItem[] = videos.map(v => ({ id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, published_at: v.publishedAt, views: v.views }))
        const kids = row.made_for_kids || (videos.length > 0 && videos.filter(v => v.madeForKids).length > videos.length / 2)
        await db.query(
          `update accounts set median_recent_views = $2, videos_sampled = $3, posts_per_month = $4, last_post_at = $5,
             recent_items = $6, made_for_kids = $7, checked_at = now() where id = $1`,
          [row.account_id, medianViews(videos), videos.length, postsPerMonth(dates, now()), lastPostAt(dates), JSON.stringify(items), kids],
        )
        sampled = videos.length
        texts = [row.description ?? '', ...videos.map(v => v.description)]
        // If the channel declares no language, use the one most of its videos declare.
        const langs = videos.map(v => v.language?.slice(0, 2).toLowerCase()).filter((l): l is string => Boolean(l))
        if (langs.length >= 3) {
          const top = [...new Set(langs)].map(l => [l, langs.filter(x => x === l).length] as const).sort((a, b) => b[1] - a[1])[0]!
          if (top[1] > langs.length / 2) {
            await db.query(`update creators set language = $2, language_source = 'declared', updated_at = now() where id = $1 and language is null`, [row.creator_id, top[0]])
          }
        }
        const duplicateWarnings = await saveLinkedAccounts(db, row.creator_id, extractLinkedHandles(texts))
        if (duplicateWarnings.length) {
          await db.query(`update brief_creators set warnings = warnings || $3 where brief_id = $1 and creator_id = $2`, [brief.id, row.creator_id, duplicateWarnings])
        }
      }

      const acc = (await db.query('select followers, median_recent_views, posts_per_month, last_post_at, made_for_kids, videos_sampled, recent_items, description from accounts where id = $1', [row.account_id])).rows[0]
      const warnings = numericWarnings({
        followers,
        medianViews: acc.median_recent_views == null ? null : Number(acc.median_recent_views),
        postsPerMonth: acc.posts_per_month == null ? null : Number(acc.posts_per_month),
        lastPostAt: acc.last_post_at ? new Date(acc.last_post_at).toISOString() : null,
        madeForKids: acc.made_for_kids,
        videosSampled: acc.videos_sampled ?? 0,
      }, now())
      const signals = gamblingSignals([acc.description, row.creator_name, ...(acc.recent_items as RecentItem[]).map(i => i.title)])
      await finish('checked', `, warnings = (select coalesce(array_agg(distinct w), '{}') from unnest(warnings || $4::text[]) w), excluded_reason = $5`, [
        warnings,
        signals.length ? `Possible gambling content (matched: ${signals.join(', ')}). Check before approving.` : null,
      ])
    }
    return { worked: true }
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      await markExhausted(db, 'youtube', 'units', config.youtubeUnitsDailyLimit, now())
      return { worked: false, blocked: outOfUnits }
    }
    throw err
  }
}

async function saveChannel(db: Pool, row: FoundRow, ch: ChannelInfo, source: string) {
  await db.query(
    `update accounts set title = $2, description = $3, handle = $4, followers = $5, uploads_ref = $6, made_for_kids = $7,
       url = $8, check_status = $9, source = $10, checked_at = now(),
       videos_sampled = null, median_recent_views = null, posts_per_month = null
     where id = $1`,
    [row.account_id, ch.title, ch.description, ch.handle, ch.subscribers, ch.uploadsPlaylistId, ch.madeForKids,
      ch.handle ? `https://www.youtube.com/@${ch.handle}` : `https://www.youtube.com/channel/${ch.id}`,
      ch.subscribers == null ? 'no_public_numbers' : 'checked', source],
  )
  // A person's correction is never overwritten by a later check.
  await db.query(
    `update creators set name = $2,
       country = case when country_source = 'person' then country when $3::text is not null then $3 else country end,
       country_source = case when country_source = 'person' then country_source when $3::text is not null then 'declared' else country_source end,
       language = case when language_source = 'person' then language when $4::text is not null then $4 else language end,
       language_source = case when language_source = 'person' then language_source when $4::text is not null then 'declared' else language_source end,
       updated_at = now()
     where id = $1`,
    [row.creator_id, ch.title || row.creator_name, ch.country?.toUpperCase() ?? null, ch.defaultLanguage?.slice(0, 2).toLowerCase() ?? null],
  )
}

/** One creator on three platforms is one record: linked handles become accounts on the same creator. */
async function saveLinkedAccounts(db: Pool, creatorId: number, links: { platform: string, handle: string, url: string }[]): Promise<string[]> {
  const warnings: string[] = []
  for (const link of links) {
    const existing = await db.query(
      `select a.creator_id, c.name from accounts a join creators c on c.id = a.creator_id where a.platform = $1 and lower(a.handle) = $2 and a.platform <> 'youtube'`,
      [link.platform, link.handle],
    )
    if (existing.rowCount) {
      if (existing.rows[0].creator_id !== creatorId) warnings.push(`Possible duplicate: ${link.platform} @${link.handle} is also linked from "${existing.rows[0].name}"`)
      continue
    }
    await db.query(
      `insert into accounts (creator_id, platform, handle, url, check_status, source, link_source)
       values ($1, $2, $3, $4, 'unchecked', 'Not checked yet', 'Link in the creator''s YouTube descriptions')`,
      [creatorId, link.platform, link.handle, link.url],
    )
  }
  return warnings
}

// ---------- Step 2b: Instagram lookups for linked accounts (version 2) ----------

async function checkInstagram({ db, config, instagram, now = () => new Date() }: Deps, brief: Brief): Promise<StepResult> {
  if (!instagram) return { worked: false }
  const rows = await db.query(
    `select distinct a.id, a.handle from accounts a join brief_creators bc on bc.creator_id = a.creator_id
     where bc.brief_id = $1 and bc.stage in ('checked', 'scored') and a.platform = 'instagram' and a.check_status = 'unchecked'
     order by a.id limit 10`,
    [brief.id],
  )
  let worked = false
  for (const row of rows.rows) {
    if (!(await reserve(db, 'instagram', 'lookups', 1, config.instagramDailyLimit, now()))) return { worked }
    try {
      const p = await instagram.lookup(row.handle)
      if (!p) {
        await db.query(`update accounts set check_status = 'no_public_numbers', source = $2, checked_at = now() where id = $1`, [row.id, `${instagram.source} (not a professional account, or not found)`])
      } else {
        const dates = p.posts.map(x => x.timestamp)
        const items: RecentItem[] = p.posts.map(x => ({ id: x.id, title: x.caption ?? '', url: x.url ?? '', published_at: x.timestamp, views: x.views }))
        await db.query(
          `update accounts set title = $2, description = $3, followers = $4, median_recent_views = $5, videos_sampled = $6,
             posts_per_month = $7, last_post_at = $8, recent_items = $9, check_status = $10, source = $11, checked_at = now() where id = $1`,
          [row.id, p.name, p.biography, p.followers, median(p.posts.map(x => x.views).filter((v): v is number => v != null)), p.posts.length,
            postsPerMonth(dates, now()), lastPostAt(dates), JSON.stringify(items), p.followers == null ? 'no_public_numbers' : 'checked', instagram.source],
        )
        // Now there is something to read, creators with no score get one.
        await db.query(
          `update brief_creators bc set stage = 'checked', score_attempts = 0, score_error = null
           from accounts a where a.id = $1 and bc.creator_id = a.creator_id and bc.stage = 'scored' and bc.fit_score is null and not bc.edited`,
          [row.id],
        )
        // A creator added by hand is named after their handle until the real name is known.
        if (p.name) await db.query(`update creators c set name = $2 from accounts a where a.id = $1 and c.id = a.creator_id and c.name like '@%'`, [row.id, p.name])
      }
      worked = true
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        await markExhausted(db, 'instagram', 'lookups', config.instagramDailyLimit, now())
        return { worked }
      }
      throw err
    }
  }
  return { worked }
}

// ---------- Step 3: scoring ----------

const EXAMPLES_PER_KIND = 12

/**
 * The decisions people have already made on this brief: approvals, rejections,
 * shortlists and hand-corrected scores. Claude sees them when it scores the
 * rest, so the scoring follows the reviewer's judgement.
 */
export async function reviewedExamples(db: Pool, briefId: number): Promise<(ReviewedExample & { creatorId: number })[]> {
  const res = await db.query(
    `select * from (
       select bc.creator_id, c.name, bc.status, bc.edited, bc.fit_score, bc.reason, bc.review_note, a.recent_items,
              row_number() over (partition by bc.status order by bc.reviewed_at desc nulls last, bc.creator_id) as rn
       from brief_creators bc
       join creators c on c.id = bc.creator_id
       join lateral (
         select * from accounts x where x.creator_id = bc.creator_id
         order by (x.platform = 'youtube') desc, x.followers desc nulls last, x.id limit 1) a on true
       where bc.brief_id = $1 and bc.stage in ('checked', 'scored') and bc.excluded_reason is null
         and (bc.status in ('approved', 'shortlisted', 'rejected') or bc.edited)
     ) t where rn <= $2 order by status, creator_id`,
    [briefId, EXAMPLES_PER_KIND],
  )
  return res.rows.map(r => ({
    creatorId: Number(r.creator_id),
    name: r.name,
    recentTitles: (r.recent_items as RecentItem[]).slice(0, 6).map(i => i.title),
    decision: r.status === 'found' ? 'score corrected' : r.status,
    personScore: r.edited ? r.fit_score : null,
    personReason: r.edited ? r.reason : null,
    note: r.review_note || null,
  }))
}

async function scoreBatch({ db, config, scorer }: Deps, brief: Brief): Promise<StepResult> {
  const rows = await db.query(
    `select bc.creator_id, bc.warnings, bc.niches, bc.excluded_reason, c.name, c.country, c.country_source, c.language, c.language_source,
            a.platform, a.title as account_title, a.description, a.followers, a.median_recent_views, a.posts_per_month, a.made_for_kids, a.recent_items
     from brief_creators bc
     join creators c on c.id = bc.creator_id
     join lateral (
       select * from accounts x where x.creator_id = bc.creator_id
       order by (x.platform = 'youtube') desc, x.followers desc nulls last, x.id limit 1) a on true
     where bc.brief_id = $1 and bc.stage = 'checked' and bc.score_attempts < 3
     order by bc.creator_id limit $2`,
    [brief.id, config.scoringConcurrency * 2],
  )
  if (rows.rowCount === 0) return { worked: false }

  // An account added by hand whose numbers have not been checked gives Claude
  // nothing to read. It is passed straight to a person, not scored on a name.
  const empty = rows.rows.filter(r => !r.description && (r.recent_items as RecentItem[]).length === 0)
  if (empty.length) {
    await db.query(
      `update brief_creators set stage = 'scored', score_error = 'Nothing public has been checked for this account yet, so it has no score. Score it by hand.'
       where brief_id = $1 and creator_id = any($2::bigint[])`,
      [brief.id, empty.map(r => r.creator_id)],
    )
    return { worked: true }
  }
  if (!scorer) return { worked: false, blocked: 'Claude is not set up (ANTHROPIC_API_KEY), so creators are listed without a fit score.' }

  const examples = await reviewedExamples(db, brief.id)
  let stop: string | undefined
  let worked = false
  const queue = [...rows.rows]
  const worker = async () => {
    for (let row = queue.shift(); row && !stop; row = queue.shift()) {
      const evidence = await db.query('select distinct title from evidence where brief_id = $1 and creator_id = $2 limit 15', [brief.id, row.creator_id])
      try {
        const result = await scorer.score({
          brief,
          channel: {
            platform: row.platform,
            name: row.name,
            description: row.description ?? '',
            declaredCountry: row.country_source === 'declared' || row.country_source === 'person' ? row.country : null,
            declaredLanguage: row.language_source === 'declared' || row.language_source === 'person' ? row.language : null,
            followers: row.followers == null ? null : Number(row.followers),
            medianViews: row.median_recent_views == null ? null : Number(row.median_recent_views),
            postsPerMonth: row.posts_per_month == null ? null : Number(row.posts_per_month),
            madeForKids: row.made_for_kids,
          },
          recentTitles: (row.recent_items as RecentItem[]).map(i => i.title),
          evidenceTitles: evidence.rows.map(e => e.title),
          examples: examples.filter(e => e.creatorId !== Number(row.creator_id)).map(({ creatorId: _id, ...e }) => e),
        })
        const warnings = [...new Set([...row.warnings, ...result.warnings])]
        const niches = [...new Set([...row.niches, ...result.niches])]
        await db.query(
          `update brief_creators set stage = 'scored', fit_score = $3, reason = $4, warnings = $5, niches = $6, estimate_note = $7,
             excluded_reason = $8, score_source = $9, scored_at = now(), score_error = null
           where brief_id = $1 and creator_id = $2 and not edited`,
          [brief.id, row.creator_id, result.fit_score, result.reason, warnings, niches, result.estimate_note,
            result.gambling_or_casino ? 'Gambling or casino content, which 1minus1\'s client rules exclude.' : null, scorer.source],
        )
        // A person's edits win: an edited record keeps its score and only moves on.
        await db.query(`update brief_creators set stage = 'scored' where brief_id = $1 and creator_id = $2 and edited`, [brief.id, row.creator_id])
        await db.query(
          `update creators set
             country = case when country_source = 'unknown' and $2::text is not null then $2 else country end,
             country_source = case when country_source = 'unknown' and $2::text is not null then 'estimate' else country_source end,
             language = case when language_source = 'unknown' and $3::text is not null then $3 else language end,
             language_source = case when language_source = 'unknown' and $3::text is not null then 'estimate' else language_source end,
             updated_at = now()
           where id = $1`,
          [row.creator_id, result.creator_country_estimate, result.creator_language_estimate],
        )
        worked = true
      } catch (err) {
        // Problems with the key or the rate limit affect every creator: stop and say so, without using up attempts.
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
          stop = 'Claude rejected the API key, so scoring has stopped. Check ANTHROPIC_API_KEY.'
        } else if (err instanceof Anthropic.RateLimitError) {
          stop = 'Claude\'s rate limit was reached. Scoring continues shortly.'
        } else {
          const message = err instanceof Error ? err.message : String(err)
          await db.query(
            `update brief_creators set score_attempts = score_attempts + 1, score_error = $3,
               stage = case when score_attempts + 1 >= 3 then 'scored' else stage end
             where brief_id = $1 and creator_id = $2`,
            [brief.id, row.creator_id, message.slice(0, 500)],
          )
          worked = true
        }
      }
    }
  }
  await Promise.all(Array.from({ length: config.scoringConcurrency }, worker))
  return { worked, blocked: stop }
}

// ---------- One pass over one brief ----------

export async function runBrief(deps: Deps, briefId: number): Promise<{ more: boolean }> {
  const { db } = deps
  const brief = (await db.query<Brief>('select * from briefs where id = $1', [briefId])).rows[0]
  if (!brief || !['running', 'waiting_quota'].includes(brief.status)) return { more: false }

  const steps = [await runSearches(deps, brief), await enrich(deps, brief), await checkInstagram(deps, brief), await scoreBatch(deps, brief)]
  const worked = steps.some(s => s.worked)
  const blocks = steps.map(s => s.blocked).filter((b): b is string => Boolean(b))
  if (worked) {
    await setStatus(db, brief.id, 'running', blocks.join(' '))
    return { more: true }
  }

  const left = (await db.query(
    `select (select count(*) from searches where brief_id = $1 and status = 'queued')::int as searches,
            (select count(*) from brief_creators where brief_id = $1 and stage = 'found')::int as unchecked,
            (select count(*) from brief_creators where brief_id = $1 and stage = 'checked' and score_attempts < 3)::int as unscored`,
    [brief.id],
  )).rows[0]
  if (left.searches > 0 || left.unchecked > 0 || (deps.scorer && left.unscored > 0)) {
    await setStatus(db, brief.id, 'waiting_quota', blocks.join(' ') || 'Waiting to continue.')
  } else {
    // Searching and checking are finished. Missing scores do not hold the list back: a person can still review it.
    await setStatus(db, brief.id, 'complete', blocks.join(' '))
  }
  return { more: false }
}

/** One pass over every active brief. Returns true if there is more to do straight away. */
export async function tick(deps: Deps): Promise<boolean> {
  const active = await deps.db.query(`select id from briefs where status in ('running', 'waiting_quota') order by id`)
  let more = false
  for (const row of active.rows) {
    try {
      if ((await runBrief(deps, row.id)).more) more = true
    } catch (err) {
      await setStatus(deps.db, row.id, 'waiting_quota', `Run stopped on an error and will retry: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500))
    }
  }
  return more
}
