import type { Db } from './types'

/** YouTube's quota day runs midnight to midnight Pacific time. */
export function quotaDay(provider: string, now = new Date()): string {
  const timeZone = provider === 'youtube' ? 'America/Los_Angeles' : 'UTC'
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * Takes `cost` from today's allowance if, and only if, it fits. The check and
 * the write are one statement, so two workers cannot both spend the last unit.
 */
export async function reserve(db: Db, provider: string, bucket: string, cost: number, limit: number, now = new Date()): Promise<boolean> {
  if (cost > limit) return false
  const res = await db.query(
    `insert into quota_usage (provider, bucket, day, used) values ($1, $2, $3, $4)
     on conflict (provider, bucket, day) do update set used = quota_usage.used + excluded.used
       where quota_usage.used + excluded.used <= $5
     returning used`,
    [provider, bucket, quotaDay(provider, now), cost, limit],
  )
  return res.rowCount === 1
}

/** The platform said the allowance is spent (for example another tool shares the key): stop for the day. */
export async function markExhausted(db: Db, provider: string, bucket: string, limit: number, now = new Date()): Promise<void> {
  await db.query(
    `insert into quota_usage (provider, bucket, day, used) values ($1, $2, $3, $4)
     on conflict (provider, bucket, day) do update set used = greatest(quota_usage.used, excluded.used)`,
    [provider, bucket, quotaDay(provider, now), limit],
  )
}

export async function usedToday(db: Db, provider: string, bucket: string, now = new Date()): Promise<number> {
  const res = await db.query('select used from quota_usage where provider = $1 and bucket = $2 and day = $3', [provider, bucket, quotaDay(provider, now)])
  return res.rows[0]?.used ?? 0
}
