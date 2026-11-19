import { quotaDay, usedToday } from '../lib/quota'

export default defineEventHandler(async (event) => {
  const { db, config, youtube, scorer, instagram } = useDeps()
  return {
    you: actor(event),
    dataMode: config.dataMode,
    youtube: {
      ready: Boolean(youtube),
      quotaDay: quotaDay('youtube'),
      searches: { used: await usedToday(db, 'youtube', 'search'), limit: config.youtubeSearchDailyLimit },
      units: { used: await usedToday(db, 'youtube', 'units'), limit: config.youtubeUnitsDailyLimit },
    },
    claude: { ready: Boolean(scorer), source: scorer?.source ?? null },
    instagram: { ready: Boolean(instagram) },
    tiktok: { ready: false },
  }
})
