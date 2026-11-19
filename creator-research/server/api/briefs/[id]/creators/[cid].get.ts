import { creatorDetail } from '../../../../lib/store'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const detail = await creatorDetail(useDeps().db, brief.id, idParam(event, 'cid'))
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Creator not found on this brief' })
  return detail
})
