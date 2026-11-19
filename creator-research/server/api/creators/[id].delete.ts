import { deleteCreator } from '../../lib/store'

// Rule 4: a creator can be deleted on request.
export default defineEventHandler(async (event) => {
  const ok = await deleteCreator(useDeps().db, idParam(event), actor(event))
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Creator not found' })
  return { ok: true }
})
