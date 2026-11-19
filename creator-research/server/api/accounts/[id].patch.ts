import { z } from 'zod'
import { audit } from '../../lib/store'

const Input = z.object({
  followers: z.number().int().min(0).max(2_000_000_000),
  median_recent_views: z.number().int().min(0).max(2_000_000_000).nullable().default(null),
})

// Numbers a person read off the platform themselves, for accounts the tool has
// no official way to check (TikTok, and Instagram until the Meta app is live).
// The source says who entered them and when, like every other number.
export default defineEventHandler(async (event) => {
  const parsed = Input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Enter the follower count as a whole number' })
  const { db } = useDeps()
  const who = actor(event)
  const res = await db.query(
    `update accounts set followers = $2, median_recent_views = $3, check_status = 'checked', checked_at = now(), source = $4
     where id = $1 and platform <> 'youtube' returning id`,
    [idParam(event), parsed.data.followers, parsed.data.median_recent_views, `Entered by hand by ${who}`],
  )
  if (!res.rowCount) throw createError({ statusCode: 409, statusMessage: 'YouTube numbers come from YouTube and cannot be typed in' })
  await audit(db, who, 'account.numbers_entered_by_hand', null, { account_id: idParam(event) })
  return { ok: true }
})
