export default defineEventHandler(async () => {
  const { db } = useDeps()
  const res = await db.query(
    `select b.*,
       (select count(*)::int from searches s where s.brief_id = b.id) as searches_total,
       (select count(*)::int from searches s where s.brief_id = b.id and s.status = 'done') as searches_done,
       (select count(*)::int from brief_creators bc where bc.brief_id = b.id and bc.stage in ('checked', 'scored')) as in_range,
       (select count(*)::int from brief_creators bc where bc.brief_id = b.id and bc.status = 'approved') as approved
     from briefs b order by b.created_at desc`,
  )
  return res.rows
})
