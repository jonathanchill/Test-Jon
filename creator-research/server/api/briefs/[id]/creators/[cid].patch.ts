import { ReviewInput } from '../../../../lib/briefs'
import { creatorDetail } from '../../../../lib/store'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const cid = idParam(event, 'cid')
  const parsed = ReviewInput.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(i => i.message).join('. ') })
  const { db } = useDeps()
  await applyReview(db, brief.id, cid, parsed.data, actor(event))
  return creatorDetail(db, brief.id, cid)
})
