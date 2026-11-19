import { audit } from '../../../lib/store'

// Follower numbers go out of date. This pulls fresh numbers for every creator
// still in play on the brief. Reviews and edited scores are kept.
export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db } = useDeps()
  // YouTube creators go back to be looked up again. Creators with no YouTube account stay where they are.
  const res = await db.query(
    `with target as (
       update brief_creators bc set stage = 'found', score_attempts = 0
       where bc.brief_id = $1 and bc.stage in ('checked', 'scored', 'out_of_range', 'not_checkable') and bc.status <> 'rejected'
         and exists (select 1 from accounts y where y.creator_id = bc.creator_id and y.platform = 'youtube')
       returning creator_id)
     update accounts set checked_at = null where platform = 'youtube' and creator_id in (select creator_id from target)`,
    [brief.id],
  )
  // Instagram accounts are looked up again too, if Instagram is connected.
  await db.query(
    `update accounts a set check_status = 'unchecked' from brief_creators bc
     where bc.brief_id = $1 and bc.creator_id = a.creator_id and bc.status <> 'rejected' and a.platform = 'instagram'`,
    [brief.id],
  )
  await db.query(`update briefs set status = 'running', status_note = '', updated_at = now() where id = $1`, [brief.id])
  await audit(db, actor(event), 'brief.recheck', brief.id, { accounts: res.rowCount })
  return { rechecking: res.rowCount }
})
