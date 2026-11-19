import { z } from 'zod'

const Input = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  status: z.enum(['found', 'shortlisted', 'approved', 'rejected']),
})

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const parsed = Input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose some creators and a status' })
  const { db } = useDeps()
  let done = 0
  const blocked: number[] = []
  for (const id of parsed.data.ids) {
    try {
      await applyReview(db, brief.id, id, { status: parsed.data.status }, actor(event))
      done++
    } catch {
      blocked.push(id) // flagged creators are skipped, never approved in bulk
    }
  }
  return { done, blocked }
})
