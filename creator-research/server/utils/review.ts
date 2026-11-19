import type { z } from 'zod'
import type { ReviewInput } from '../lib/briefs'
import { audit } from '../lib/store'
import type { Db } from '../lib/types'

/** Applies one person's review of one creator: approve, reject, shortlist, or edit what Claude wrote. */
export async function applyReview(db: Db, briefId: number, creatorId: number, input: z.infer<typeof ReviewInput>, who: string) {
  const cur = (await db.query('select stage, status, excluded_reason from brief_creators where brief_id = $1 and creator_id = $2', [briefId, creatorId])).rows[0]
  if (!cur) throw createError({ statusCode: 404, statusMessage: 'Creator not found on this brief' })
  if (!['checked', 'scored'].includes(cur.stage) && input.status && input.status !== 'rejected') {
    throw createError({ statusCode: 409, statusMessage: 'This creator has not been checked, so cannot be shortlisted or approved' })
  }
  const stillExcluded = cur.excluded_reason && !input.clear_exclusion
  if (stillExcluded && (input.status === 'approved' || input.status === 'shortlisted')) {
    throw createError({ statusCode: 409, statusMessage: `Blocked: ${cur.excluded_reason} A person must clear the flag first.` })
  }

  const sets: string[] = []
  const params: unknown[] = [briefId, creatorId]
  const set = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`) }
  if (input.status) { set('status', input.status); set('reviewed_by', who); sets.push('reviewed_at = now()') }
  if (input.fit_score != null) set('fit_score', input.fit_score)
  if (input.reason != null) set('reason', input.reason)
  if (input.warnings) set('warnings', input.warnings)
  if (input.niches) set('niches', input.niches)
  if (input.review_note != null) set('review_note', input.review_note)
  if (input.clear_exclusion) sets.push('excluded_reason = null')
  const edited = input.fit_score != null || input.reason != null || input.warnings != null || input.niches != null
  if (edited) sets.push(`edited = true, stage = 'scored'`)
  if (sets.length) await db.query(`update brief_creators set ${sets.join(', ')} where brief_id = $1 and creator_id = $2`, params)

  if (input.country !== undefined) {
    await db.query(`update creators set country = $2, country_source = $3, updated_at = now() where id = $1`, [creatorId, input.country, input.country ? 'person' : 'unknown'])
  }
  await audit(db, who, 'creator.reviewed', briefId, { creator_id: creatorId, ...input, was_excluded: cur.excluded_reason ?? undefined })
}
