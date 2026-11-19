export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db } = useDeps()
  const res = await db.query(
    `select id, kind, term, niche, region, language, status, term_source, result_count, new_channels, error, run_at
     from searches where brief_id = $1 order by (kind = 'product') desc, id`,
    [brief.id],
  )
  return res.rows
})
