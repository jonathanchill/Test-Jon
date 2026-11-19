import { tick } from '../lib/pipeline'

// The background run. It works through active briefs in small steps, stops at
// each platform's daily limit and carries on when the limit resets. A database
// lock makes sure only one copy of the app does the work.

const LOCK_KEY = 19112026

export default defineNitroPlugin((nitro) => {
  if (import.meta.prerender) return
  let stopped = false
  nitro.hooks.hook('close', () => { stopped = true })

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  async function loop() {
    let deps: ReturnType<typeof useDeps>
    try {
      deps = useDeps()
    } catch {
      console.warn('[worker] DATABASE_URL is not set; background runs are off')
      return
    }
    if (!deps.config.workerEnabled) return
    while (!stopped) {
      let idle = true
      try {
        const lock = await deps.db.connect()
        try {
          const got = await lock.query('select pg_try_advisory_lock($1) as ok', [LOCK_KEY])
          if (got.rows[0].ok) {
            try {
              idle = !(await tick(deps))
            } finally {
              await lock.query('select pg_advisory_unlock($1)', [LOCK_KEY])
            }
          }
        } finally {
          lock.release()
        }
      } catch (err) {
        console.error('[worker]', err instanceof Error ? err.message : err)
      }
      await sleep(idle ? 20_000 : 300)
    }
  }
  void loop()
})
