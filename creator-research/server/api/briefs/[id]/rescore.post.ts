import { z } from 'zod'
import { audit } from '../../../lib/store'

// Scoring needs tuning on the first real brief: change the guidance, then score
// again. Scores a person has edited are kept.
export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const body = z.object({ notes: z.string().trim().max(4000).optional() }).parse(await readBody(event) ?? {})
  const { db } = useDeps()
  if (body.notes != null) await db.query('update briefs set notes = $2 where id = $1', [brief.id, body.notes])
  const res = await db.query(
    `update brief_creators set stage = 'checked', score_attempts = 0, score_error = null
     where brief_id = $1 and stage = 'scored' and not edited and status in ('found', 'shortlisted')`,
    [brief.id],
  )
  await db.query(`update briefs set status = 'running', status_note = '', updated_at = now() where id = $1`, [brief.id])
  await audit(db, actor(event), 'brief.rescored', brief.id, { creators: res.rowCount })
  return { rescoring: res.rowCount }
})
