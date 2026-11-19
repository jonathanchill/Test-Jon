import { audit } from '../../../lib/store'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db } = useDeps()
  await db.query(`update briefs set status = 'running', status_note = '', updated_at = now() where id = $1`, [brief.id])
  await audit(db, actor(event), 'brief.started', brief.id)
  return { ok: true }
})
