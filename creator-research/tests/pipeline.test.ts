import ExcelJS from 'exceljs'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from '../scripts/migrate.mjs'
import { getConfig } from '../server/lib/config'
import { createDemoScorer, createDemoYouTubeClient } from '../server/lib/demo'
import { buildExport } from '../server/lib/export'
import { tick, type Deps } from '../server/lib/pipeline'
import { planBrief } from '../server/lib/plan'
import { reserve } from '../server/lib/quota'
import { briefCounts, deleteCreator, listCreators } from '../server/lib/store'
import { examplesBlock } from '../server/lib/claude'
import type { Brief, ScoreInput } from '../server/lib/types'

// Runs the whole pipeline against a real PostgreSQL database, with the demo
// YouTube client standing in for the API. Set TEST_DATABASE_URL to run it.
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('pipeline', () => {
  let db: pg.Pool
  let deps: Deps
  let clock = new Date('2026-11-19T12:00:00Z')
  let brief: Brief

  const drain = async () => { for (let i = 0; i < 200 && await tick(deps); i++) { /* keep going */ } }
  const reload = async () => (await db.query<Brief>('select * from briefs where id = $1', [brief.id])).rows[0]!

  beforeAll(async () => {
    db = new pg.Pool({ connectionString: url })
    await db.query('drop schema public cascade; create schema public')
    await migrate(url)
    deps = {
      db,
      config: { ...getConfig(), youtubeSearchDailyLimit: 6, youtubeUnitsDailyLimit: 10_000, recheckDays: 30, scoringConcurrency: 3 },
      youtube: createDemoYouTubeClient(() => clock),
      scorer: createDemoScorer(),
      instagram: null,
      now: () => clock,
    }
    brief = (await db.query<Brief>(
      `insert into briefs (client, name, niches, countries, languages, follower_min, products, exclusions)
       values ('My Arcade', 'UK and France', '{retro gaming,nostalgia toys,gadgets}', '{GB,FR}', '{en,fr}', 10000, '{Evercade,Arcade1Up}', '{Coin-Op Kev (demo)}') returning *`,
    )).rows[0]!
    await planBrief(db, brief, null)
    await db.query(`update briefs set status = 'running' where id = $1`, [brief.id])
  })
  afterAll(async () => { await db.end() })

  it('never spends more than the daily allowance', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserve(db, 'test', 'b', 1, 7, clock)))
    expect(results.filter(Boolean)).toHaveLength(7)
  })

  it('stops at the daily search limit, product searches first', async () => {
    await drain()
    const searches = (await db.query(`select kind, status from searches where brief_id = $1 order by id`, [brief.id])).rows
    expect(searches.filter(s => s.status === 'done')).toHaveLength(6)
    expect(searches.filter(s => s.kind === 'product').every(s => s.status === 'done')).toBe(true)
    const b = await reload()
    expect(b.status).toBe('waiting_quota')
    expect(b.status_note).toMatch(/search limit/)
  })

  it('carries on the next day and finishes', async () => {
    clock = new Date('2026-11-20T12:00:00Z')
    await drain()
    expect((await reload()).status).toBe('complete')
    const queued = await db.query(`select 1 from searches where brief_id = $1 and status <> 'done'`, [brief.id])
    expect(queued.rowCount).toBe(0)
  })

  it('records one creator per channel with numbers, source, date and the search that found them', async () => {
    const rows = await listCreators(db, brief.id)
    expect(rows.length).toBeGreaterThan(10)
    expect(new Set(rows.map(r => r.creator_id)).size).toBe(rows.length)
    for (const r of rows) {
      expect(r.followers).toBeGreaterThanOrEqual(10_000)
      expect(r.source).toMatch(/Demo data/)
      expect(r.checked_at).toBeTruthy()
      expect(r.fit_score).toBeGreaterThanOrEqual(1)
      expect(r.evidence_count).toBeGreaterThan(0)
    }
    const linked = rows.flatMap(r => r.linked)
    expect(linked.some(l => l.platform === 'instagram' && l.check_status === 'unchecked')).toBe(true)
    const withSearch = await db.query('select count(*)::int as n from evidence where brief_id = $1 and search_id is null', [brief.id])
    expect(withSearch.rows[0].n).toBe(0)
  })

  it('keeps small, hidden and left-out channels off the review list but in the count', async () => {
    const all = await listCreators(db, brief.id, { stage: 'all' })
    expect(all.some(r => r.stage === 'out_of_range')).toBe(true)
    expect(all.some(r => r.stage === 'not_checkable')).toBe(true)
    const kev = all.find(r => r.name.startsWith('Coin-Op Kev'))
    expect(kev).toMatchObject({ stage: 'left_out', status: 'rejected' })
    const counts = await briefCounts(db, brief)
    expect(counts.funnel.channelsFound).toBe(all.length)
    expect(counts.notChecked.noPublicNumbers).toBeGreaterThan(0)
    expect(counts.byCountry.rows.reduce((n, r) => n + r.total, 0)).toBe(counts.fit)
  })

  it('blocks gambling channels from approval and leaves them out of the count', async () => {
    const rows = await listCreators(db, brief.id)
    const casino = rows.filter(r => /Casino/.test(r.name))
    expect(casino.length).toBeGreaterThan(0)
    expect(casino.every(r => r.excluded_reason)).toBe(true)
    // A restored arcade machine is not gambling: no retro channel is flagged.
    expect(rows.filter(r => r.excluded_reason).every(r => /Casino/.test(r.name))).toBe(true)
  })

  it('exports approved creators only', async () => {
    const rows = (await listCreators(db, brief.id)).filter(r => !r.excluded_reason)
    const picked = rows.slice(0, 3)
    await db.query(`update brief_creators set status = 'approved', reviewed_by = 'Jonathan' where brief_id = $1 and creator_id = any($2::bigint[])`, [brief.id, picked.map(r => r.creator_id)])
    const { buffer, count } = await buildExport(db, brief, 'Jonathan')
    expect(count).toBe(3)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as never)
    const sheet = wb.getWorksheet('Creators')!
    expect(sheet.rowCount).toBe(4)
    const names = [2, 3, 4].map(i => sheet.getRow(i).getCell(1).value)
    expect(names.sort()).toEqual(picked.map(r => r.name).sort())
    expect(wb.getWorksheet('Summary')!.getRow(3).getCell(2).value).toBe('Jonathan')
  })

  it('shows Claude the decisions a person has already made when it scores the rest', async () => {
    const all = await listCreators(db, brief.id)
    const approved = all.filter(r => r.status === 'approved')
    const rejected = all.find(r => r.status === 'found' && !r.excluded_reason)!
    await db.query(`update brief_creators set status = 'rejected', review_note = 'Too much swearing for this client' where brief_id = $1 and creator_id = $2`, [brief.id, rejected.creator_id])
    await db.query(`update brief_creators set stage = 'checked' where brief_id = $1 and stage = 'scored' and status = 'found'`, [brief.id])
    await db.query(`update briefs set status = 'running' where id = $1`, [brief.id])
    const seen: ScoreInput[] = []
    const real = deps.scorer!
    deps.scorer = { source: 'spy', score: async (input) => { seen.push(input); return real.score(input) } }
    await drain()
    deps.scorer = real
    expect(seen.length).toBeGreaterThan(0)
    for (const input of seen) {
      const names = input.examples!.map(e => e.name)
      for (const a of approved) expect(names).toContain(a.name)
      expect(names).not.toContain(input.channel.name)
      expect(input.examples!.find(e => e.name === rejected.name)).toMatchObject({ decision: 'rejected', note: 'Too much swearing for this client' })
      expect(input.examples!.some(e => /Casino/.test(e.name))).toBe(false)
    }
    const text = examplesBlock(seen[0]!.examples)!
    expect(text).toContain('Too much swearing for this client')
    expect(text).toContain(approved[0]!.name)
  })

  it('deletes a creator on request and does not find them again', async () => {
    const [target] = await listCreators(db, brief.id)
    expect(await deleteCreator(db, target!.creator_id, 'Jonathan')).toBe(true)
    expect((await db.query('select 1 from accounts where creator_id = $1', [target!.creator_id])).rowCount).toBe(0)
    expect((await db.query('select 1 from evidence where creator_id = $1', [target!.creator_id])).rowCount).toBe(0)
    await db.query(`update searches set status = 'queued' where brief_id = $1`, [brief.id])
    await db.query(`update briefs set status = 'running' where id = $1`, [brief.id])
    clock = new Date('2026-11-21T12:00:00Z')
    await drain()
    clock = new Date('2026-11-22T12:00:00Z')
    await drain()
    clock = new Date('2026-11-23T12:00:00Z')
    await drain()
    expect((await reload()).status).toBe('complete')
    const again = await listCreators(db, brief.id, { stage: 'all' })
    expect(again.some(r => r.name === target!.name)).toBe(false)
  })
})
