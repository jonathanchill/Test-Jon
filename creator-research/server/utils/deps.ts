import pg from 'pg'
import type { H3Event } from 'h3'
import { createClaudeExpander, createClaudeScorer } from '../lib/claude'
import { getConfig } from '../lib/config'
import { createDemoScorer, createDemoYouTubeClient } from '../lib/demo'
import { createInstagramClient } from '../lib/instagram'
import type { Deps } from '../lib/pipeline'
import type { Brief, TermExpander } from '../lib/types'
import { createYouTubeClient } from '../lib/youtube'

// Ids and counts are well inside the safe integer range, so read bigint columns as numbers.
pg.types.setTypeParser(20, Number)

let cached: (Deps & { expander: TermExpander | null }) | null = null

/** Builds the database pool and platform clients once, from environment settings. */
export function useDeps() {
  if (cached) return cached
  const config = getConfig()
  if (!config.databaseUrl) throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL is not set' })
  const db = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
  const demo = config.dataMode === 'demo'
  cached = {
    db,
    config,
    youtube: demo ? createDemoYouTubeClient() : config.youtubeApiKey ? createYouTubeClient(config.youtubeApiKey) : null,
    scorer: demo ? createDemoScorer() : config.anthropicConfigured ? createClaudeScorer({ model: config.scoringModel, effort: config.scoringEffort }) : null,
    expander: !demo && config.anthropicConfigured ? createClaudeExpander({ model: config.scoringModel }) : null,
    instagram: !demo && config.instagramAccessToken && config.instagramUserId
      ? createInstagramClient({ accessToken: config.instagramAccessToken, userId: config.instagramUserId, version: config.graphApiVersion })
      : null,
  }
  return cached
}

export function idParam(event: H3Event, name = 'id'): number {
  const n = Number(getRouterParam(event, name))
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'Bad id' })
  return n
}

export async function loadBrief(event: H3Event): Promise<Brief> {
  const { db } = useDeps()
  const brief = (await db.query<Brief>('select * from briefs where id = $1', [idParam(event)])).rows[0]
  if (!brief) throw createError({ statusCode: 404, statusMessage: 'Brief not found' })
  return brief
}

/** Who is acting: the name they signed in with. Stored with every approval and edit. */
export function actor(event: H3Event): string {
  return (event.context.actor as string | undefined) || 'local'
}
