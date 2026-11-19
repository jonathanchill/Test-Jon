import { briefCounts } from '../../../lib/store'

export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const min = Number(getQuery(event).minScore)
  return briefCounts(useDeps().db, brief, min >= 1 && min <= 5 ? Math.round(min) : 3)
})
