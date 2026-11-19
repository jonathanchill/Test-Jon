import { audit } from '../../../lib/store'

// Follower numbers go out of date. This pulls fresh numbers for every creator
// still in play on the brief. Reviews and edited scores are kept.
export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db } = useDeps()
  const res = await db.query(
    `with target as (
       update brief_creators set stage = 'found', score_attempts = 0
       where brief_id = $1 and stage in ('checked', 'scored', 'out_of_range', 'not_checkable') and status <> 'rejected'
       returning creator_id)
     update accounts set checked_at = null where platform = 'youtube' and creator_id in (select creator_id from target)`,
    [brief.id],
  )
  await db.query(`update briefs set status = 'running', status_note = '', updated_at = now() where id = $1`, [brief.id])
  await audit(db, actor(event), 'brief.recheck', brief.id, { accounts: res.rowCount })
  return { rechecking: res.rowCount }
})
