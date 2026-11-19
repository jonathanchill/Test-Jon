import { buildExport } from '../../../lib/export'
import { audit } from '../../../lib/store'

// Rule 7: nothing goes to a client until a person has approved it. The sheet
// holds approved creators only and records who signed the list off.
export default defineEventHandler(async (event) => {
  const brief = await loadBrief(event)
  const { db, config } = useDeps()
  if (getQuery(event).confirm !== 'yes') throw createError({ statusCode: 400, statusMessage: 'Confirm that you have reviewed and approve this list' })
  if (config.dataMode === 'demo' && getQuery(event).demo !== 'yes') throw createError({ statusCode: 400, statusMessage: 'This is demo data and must not go to a client' })
  const who = actor(event)
  const { buffer, count } = await buildExport(db, brief, who)
  if (count === 0) throw createError({ statusCode: 409, statusMessage: 'No creators are approved yet' })
  await audit(db, who, 'brief.exported', brief.id, { creators: count })
  const name = `${brief.client} ${brief.name} creators ${new Date().toISOString().slice(0, 10)}`.replace(/[^A-Za-z0-9 _-]+/g, '').replace(/\s+/g, '-')
  setHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'content-disposition', `attachment; filename="${config.dataMode === 'demo' ? 'DEMO-' : ''}${name}.xlsx"`)
  return buffer
})
