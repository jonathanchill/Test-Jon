import { audit } from '../../lib/store'

export default defineEventHandler(async (event) => {
  const { db } = useDeps()
  // Only searches that have not run can be removed: a search that has run is part of the record of how a list was built.
  const res = await db.query(`delete from searches where id = $1 and status = 'queued' returning brief_id, term`, [idParam(event)])
  if (!res.rowCount) throw createError({ statusCode: 409, statusMessage: 'Only searches that have not run yet can be removed' })
  await audit(db, actor(event), 'search.removed', res.rows[0].brief_id, { term: res.rows[0].term })
  return { ok: true }
})
