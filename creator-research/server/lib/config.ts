// Every setting and key is read from the environment. Nothing is hard-coded and
// keys are never logged or returned by the API.

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function getConfig() {
  const env = process.env
  return {
    databaseUrl: env.DATABASE_URL ?? '',
    /** 'live' uses the official APIs. 'demo' uses invented channels and a keyword scorer, for trying the screens. */
    dataMode: env.DATA_MODE === 'demo' ? 'demo' as const : 'live' as const,
    appPassword: env.APP_PASSWORD ?? '',
    workerEnabled: env.WORKER_ENABLED !== 'false',

    youtubeApiKey: env.YOUTUBE_API_KEY ?? '',
    /** Since 1 June 2026 searches have their own allowance of about 100 a day. */
    youtubeSearchDailyLimit: int('YOUTUBE_SEARCH_DAILY_LIMIT', 100),
    /** Channel and video lookups cost 1 unit each from 10,000 a day. */
    youtubeUnitsDailyLimit: int('YOUTUBE_UNITS_DAILY_LIMIT', 10000),
    youtubeResultsPerSearch: Math.min(50, Math.max(1, int('YOUTUBE_RESULTS_PER_SEARCH', 50))),
    recentVideoSample: Math.min(20, Math.max(10, int('RECENT_VIDEO_SAMPLE', 20))),
    /** Numbers older than this are re-checked. 0 switches re-checks off. */
    recheckDays: int('RECHECK_DAYS', 30),

    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
    scoringModel: env.SCORING_MODEL || 'claude-opus-5-5',
    scoringEffort: (['low', 'medium', 'high'].includes(env.SCORING_EFFORT ?? '') ? env.SCORING_EFFORT : 'medium') as 'low' | 'medium' | 'high',
    scoringConcurrency: Math.max(1, int('SCORING_CONCURRENCY', 4)),

    instagramAccessToken: env.INSTAGRAM_ACCESS_TOKEN ?? '',
    instagramUserId: env.INSTAGRAM_USER_ID ?? '',
    instagramDailyLimit: int('INSTAGRAM_DAILY_LIMIT', 1000),
    graphApiVersion: env.GRAPH_API_VERSION || 'v24.0',
  }
}

export type Config = ReturnType<typeof getConfig>
