import { z } from 'zod'
import { addManualCreators, parseManualEntries } from '../../../../lib/manual'
import { audit } from '../../../../lib/store'

const Input = z.object({
  platform: z.enum(['youtube', 'instagram', 'tiktok']),
  text: z.string().max(20_000),
})

// Creators a person found themselves, for example in TikTok One or Instagram's
// creator marketplace. One handle or link per line.
export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const parsed = Input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose a platform and paste at least one handle or link' })
  const { entries, invalid } = parseManualEntries(parsed.data.text, parsed.data.platform)
  if (entries.length > 200) throw createError({ statusCode: 400, statusMessage: 'Add at most 200 at a time' })
  const deps = useDeps()
  const results = await addManualCreators(deps, brief, entries, actor(event))
  const added = results.filter(r => r.outcome === 'added').length
  // YouTube channels need their numbers pulled, so a finished brief starts running again.
  if (added && brief.status === 'complete' && entries.some(e => e.platform === 'youtube')) {
    await deps.db.query(`update briefs set status = 'running', status_note = '' where id = $1`, [brief.id])
  }
  await audit(deps.db, actor(event), 'creators.added_by_hand', brief.id, { added, platform: parsed.data.platform })
  return { added, results, invalid }
})
