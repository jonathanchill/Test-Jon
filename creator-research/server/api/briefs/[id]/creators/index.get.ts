import { listCreators } from '../../../../lib/store'
import type { BandKey } from '../../../../lib/metrics'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const q = getQuery(event)
  const str = (v: unknown) => typeof v === 'string' && v ? v : undefined
  return listCreators(useDeps().db, brief.id, {
    country: str(q.country),
    niche: str(q.niche),
    band: str(q.band) as BandKey | undefined,
    minScore: Number(q.minScore) || undefined,
    status: str(q.status),
    stage: str(q.stage),
    q: str(q.q),
  })
})
