import ExcelJS from 'exceljs'
import { FOLLOWER_BANDS } from './metrics'
import { briefCounts, listCreators, type CountTable } from './store'
import type { Brief, Db } from './types'

const day = (d: string | Date | null) => d ? new Date(d).toISOString().slice(0, 10) : ''

/**
 * The sheet that goes to the client. It contains approved creators only, and
 * cannot be made without the name of the person who approved the list.
 */
export async function buildExport(db: Db, brief: Brief, approvedBy: string): Promise<{ buffer: Buffer, count: number }> {
  const approved = (await listCreators(db, brief.id, { status: 'approved' })).filter(r => !r.excluded_reason)
  const counts = await briefCounts(db, brief)
  const wb = new ExcelJS.Workbook()
  wb.creator = '1minus1 creator research tool'
  wb.created = new Date()

  // ---- Summary ----
  const s = wb.addWorksheet('Summary')
  s.columns = [{ width: 34 }, ...FOLLOWER_BANDS.map(() => ({ width: 20 })), { width: 12 }]
  const heading = (text: string) => { const r = s.addRow([text]); r.font = { bold: true, size: 12 }; return r }
  s.addRow([`${brief.client}: ${brief.name}`]).font = { bold: true, size: 14 }
  s.addRow(['Creators on this list', approved.length])
  s.addRow(['Approved by', approvedBy])
  s.addRow(['Exported', day(new Date())])
  s.addRow(['Countries', brief.countries.join(', ')])
  s.addRow(['Niches', brief.niches.join(', ')])
  s.addRow(['Follower range', `${brief.follower_min.toLocaleString('en-GB')}${brief.follower_max ? ` to ${brief.follower_max.toLocaleString('en-GB')}` : ' and above'}`])
  s.addRow([])

  const bandOf = (followers: number | null) => FOLLOWER_BANDS.find(b => followers != null && followers >= b.min && followers <= b.max)?.key ?? 'unknown'
  const local = (label: string, keysOf: (r: typeof approved[number]) => string[]): CountTable => {
    const map = new Map<string, { key: string, byBand: Record<string, number>, total: number }>()
    for (const r of approved) {
      for (const key of keysOf(r)) {
        const e = map.get(key) ?? { key, byBand: {}, total: 0 }
        e.byBand[bandOf(r.followers)] = (e.byBand[bandOf(r.followers)] ?? 0) + 1
        e.total++
        map.set(key, e)
      }
    }
    return { label, rows: [...map.values()].sort((a, b) => b.total - a.total) }
  }
  const writeTable = (title: string, t: CountTable) => {
    heading(title)
    s.addRow([t.label, ...FOLLOWER_BANDS.map(b => b.label), 'Total']).font = { bold: true }
    for (const row of t.rows) s.addRow([row.key, ...FOLLOWER_BANDS.map(b => row.byBand[b.key] ?? 0), row.total])
    s.addRow([])
  }
  writeTable('This list, by country and follower count', local('Country', r => [r.country ? (r.country_source === 'estimate' ? `${r.country} (estimate)` : r.country) : 'Unknown']))
  writeTable('This list, by niche and follower count', local('Niche', r => r.niches.length ? r.niches : ['No niche matched']))
  writeTable(`All creators found who fit the brief (fit score ${counts.minScore} or higher): ${counts.fit}`, counts.byCountry)
  writeTable('All creators found who fit, by niche', counts.byNiche)

  heading('How to read this')
  for (const line of [
    'Follower and view numbers are for the creator\'s main platform. Each row shows where the numbers came from and the date they were checked.',
    'Country is where the creator says they are based. Where it is marked as an estimate, it was judged from language and content.',
    'This list does not say where a creator\'s audience lives or how old they are. That information is not public.',
    'A creator who covers two niches is counted under both, so niche rows can add up to more than the total.',
    `Creators were found through YouTube searches, plus any the team added by hand. ${counts.notChecked.noPublicNumbers} channel(s) hide their subscriber count and could not be checked.`,
  ]) s.addRow([line])

  // ---- Creators ----
  const c = wb.addWorksheet('Creators')
  c.columns = [
    { header: 'Creator', key: 'name', width: 30 },
    { header: 'Country', key: 'country', width: 14 },
    { header: 'Language', key: 'language', width: 10 },
    { header: 'Niches', key: 'niches', width: 26 },
    { header: 'Main platform', key: 'platform', width: 12 },
    { header: 'Link', key: 'link', width: 42 },
    { header: 'Followers', key: 'followers', width: 13 },
    { header: 'Median views, recent posts', key: 'views', width: 16 },
    { header: 'Posts per month', key: 'ppm', width: 10 },
    { header: 'Fit (1 to 5)', key: 'fit', width: 8 },
    { header: 'Why', key: 'reason', width: 60 },
    { header: 'Notes', key: 'warnings', width: 50 },
    { header: 'YouTube', key: 'youtube', width: 34 },
    { header: 'Instagram', key: 'instagram', width: 34 },
    { header: 'TikTok', key: 'tiktok', width: 34 },
    { header: 'Numbers checked on', key: 'checked', width: 14 },
    { header: 'Source of numbers', key: 'source', width: 22 },
  ]
  c.getRow(1).font = { bold: true }
  c.views = [{ state: 'frozen', ySplit: 1 }]
  for (const r of approved) {
    const link = (platform: string) => r.primary_platform === platform ? r.primary_url : r.linked.find(l => l.platform === platform)?.url ?? ''
    c.addRow({
      name: r.name,
      country: r.country ? `${r.country}${r.country_source === 'estimate' ? ' (estimate)' : ''}` : 'Unknown',
      language: r.language ?? '',
      niches: r.niches.join(', '),
      platform: r.primary_platform,
      link: r.primary_url,
      followers: r.followers,
      views: r.median_recent_views,
      ppm: r.posts_per_month,
      fit: r.fit_score,
      reason: r.reason ?? '',
      warnings: [...r.warnings, r.estimate_note ? `Estimate: ${r.estimate_note}` : ''].filter(Boolean).join('; '),
      youtube: link('youtube'),
      instagram: link('instagram'),
      tiktok: link('tiktok'),
      checked: day(r.checked_at),
      source: r.source,
    })
  }
  c.getColumn('followers').numFmt = '#,##0'
  c.getColumn('views').numFmt = '#,##0'

  if (approved.length > 0) await db.query('insert into exports (brief_id, approved_by, creator_count) values ($1, $2, $3)', [brief.id, approvedBy, approved.length])
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), count: approved.length }
}
