import { z } from 'zod'
import { audit } from '../../../lib/store'

const Input = z.object({
  kind: z.enum(['product', 'niche']),
  term: z.string().trim().min(2).max(120),
  niche: z.string().trim().max(200).nullable().default(null),
  region: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(s => s.toUpperCase()),
  language: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(s => s.toLowerCase()),
})

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const parsed = Input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(i => i.message).join('. ') })
  const s = parsed.data
  const { db } = useDeps()
  const res = await db.query(
    `insert into searches (brief_id, kind, term, niche, region, language, term_source) values ($1, $2, $3, $4, $5, $6, 'person')
     on conflict do nothing returning id`,
    [brief.id, s.kind, s.term, s.kind === 'niche' ? s.niche : null, s.region, s.language],
  )
  if (!res.rowCount) throw createError({ statusCode: 409, statusMessage: 'That search is already in the plan' })
  // A finished brief picks the new search up on the next pass.
  if (brief.status === 'complete') await db.query(`update briefs set status = 'running', status_note = '' where id = $1`, [brief.id])
  await audit(db, actor(event), 'search.added', brief.id, { term: s.term, region: s.region })
  return { id: res.rows[0].id }
})
