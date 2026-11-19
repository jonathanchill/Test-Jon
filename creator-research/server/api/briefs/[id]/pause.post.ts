import { audit } from '../../../lib/store'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db } = useDeps()
  await db.query(`update briefs set status = 'paused', status_note = 'Paused by ' || $2, updated_at = now() where id = $1`, [brief.id, actor(event)])
  await audit(db, actor(event), 'brief.paused', brief.id)
  return { ok: true }
})
