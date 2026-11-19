import { BriefInput } from '../../lib/briefs'
import { planBrief } from '../../lib/plan'
import { audit } from '../../lib/store'
import type { Brief } from '../../lib/types'

export default defineEventHandler(async (event) => {
  const parsed = BriefInput.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(i => i.message).join('. ') })
  const b = parsed.data
  const { db, expander } = useDeps()
  const brief = (await db.query<Brief>(
    `insert into briefs (client, name, niches, countries, languages, follower_min, follower_max, products, exclusions, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [b.client, b.name, b.niches, b.countries, b.languages, b.follower_min, b.follower_max, b.products, b.exclusions, b.notes, actor(event)],
  )).rows[0]!
  // The search plan is written straight away so it can be read and edited before anything runs.
  const plan = await planBrief(db, brief, expander)
  if (plan.note) await db.query('update briefs set status_note = $2 where id = $1', [brief.id, plan.note])
  await audit(db, actor(event), 'brief.created', brief.id, { searches: plan.added })
  return { id: brief.id, searches: plan.added, note: plan.note }
})
