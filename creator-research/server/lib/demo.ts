import type { ChannelInfo, Scorer, SearchHit, VideoInfo, YouTubeClient } from './types'

// DEMO MODE ONLY (DATA_MODE=demo). Every channel here is invented so the
// screens can be tried before the Google key exists. Nothing in this file is
// real data, and demo scores come from keyword matching, not from Claude.

interface Theme {
  key: string
  keywords: Record<'en' | 'fr', string[]>
  names: Record<'en' | 'fr', string[]>
  titles: Record<'en' | 'fr', string[]>
  kids?: boolean
}

const THEMES: Theme[] = [
  {
    key: 'retro',
    keywords: { en: ['retro', 'gaming', 'handheld', 'evercade', 'arcade1up', 'arcade', 'console', 'game boy'], fr: ['retro', 'retrogaming', 'console', 'evercade', 'arcade1up', 'borne', 'arcade', 'portable'] },
    names: { en: ['Pixel Attic', 'Cartridge Corner', 'The CRT Shed', 'Handheld Harriet', 'Coin-Op Kev'], fr: ['Le Grenier à Pixels', 'Cartouche & Cie', 'Borne Again FR', 'Papa Rétro', 'Manette Vintage'] },
    titles: {
      en: ['Evercade EXP review: still worth it?', 'Arcade1Up cabinet build and first impressions', 'Top 10 retro handhelds under £100', 'My retro gaming room tour', 'Game Boy restoration: yellowed to mint', 'Is this mini arcade any good?', 'Retro handheld unboxing and test'],
      fr: ['Test Evercade EXP : ça vaut le coup ?', 'Je monte une borne Arcade1Up', 'Top 10 des consoles rétro portables', 'Visite de ma salle rétrogaming', 'Restauration d\'une Game Boy', 'Cette mini borne d\'arcade est-elle bien ?', 'Déballage console rétro portable'],
    },
  },
  {
    key: 'nostalgia',
    keywords: { en: ['nostalgia', '80s', '90s', 'toys', 'toy', 'collection', 'vintage'], fr: ['nostalgie', 'annees 80', 'annees 90', 'jouets', 'jouet', 'collection', 'vintage'] },
    names: { en: ['Saturday Morning Shelf', 'Eighties Emma', 'Boxed & Carded', 'The Toy Loft'], fr: ['Samedi Matin Vintage', 'Génération Club Do', 'Jouets d\'Hier', 'La Malle aux 80s'] },
    titles: {
      en: ['80s toys you forgot existed', 'My vintage toy collection tour', 'Car boot haul: 90s toys for a fiver', 'Ranking every 80s cartoon toy line', 'Unboxing a sealed toy from 1987', 'Nostalgia gift guide for grown-ups'],
      fr: ['Ces jouets des années 80 que vous avez oubliés', 'Visite de ma collection de jouets vintage', 'Brocante : jouets des années 90 pour 5 €', 'Je classe les jouets de dessins animés des années 80', 'Déballage d\'un jouet scellé de 1987', 'Idées cadeaux nostalgie pour adultes'],
    },
  },
  {
    key: 'gadgets',
    keywords: { en: ['gadgets', 'gadget', 'tech', 'gifting', 'gift', 'gifts', 'review'], fr: ['gadgets', 'gadget', 'tech', 'cadeau', 'cadeaux', 'test'] },
    names: { en: ['Desk Drawer Tech', 'Gadget Gareth', 'Small Box Reviews', 'Useful or Useless'], fr: ['Tiroir à Gadgets', 'Le Testeur du Dimanche', 'Petit Colis Tech', 'Utile ou Futile'] },
    titles: {
      en: ['10 gadgets under £30 that are actually good', 'Testing viral desk gadgets', 'Gift ideas for people who have everything', 'Is this mini arcade any good?', 'Tiny tech unboxing', 'Gadgets I still use a year later'],
      fr: ['10 gadgets à moins de 30 € vraiment bien', 'Je teste des gadgets de bureau viraux', 'Idées cadeaux pour ceux qui ont tout', 'Cette mini borne d\'arcade est-elle bien ?', 'Déballage mini tech', 'Les gadgets que j\'utilise encore un an après'],
    },
  },
  {
    key: 'vanlife',
    keywords: { en: ['van', 'van life', 'vanlife', 'campervan', 'gadgets'], fr: ['van', 'vanlife', 'fourgon', 'amenage', 'gadgets'] },
    names: { en: ['Slow Road Sam', 'Two Mugs One Van'], fr: ['Fourgon & Liberté', 'Route Lente'] },
    titles: {
      en: ['Van tour after two years on the road', 'Van life gadgets we actually use', 'Rainy day in the campervan: retro games night', 'What van life costs per month'],
      fr: ['Visite du fourgon après deux ans', 'Les gadgets vanlife qu\'on utilise vraiment', 'Jour de pluie dans le van : soirée jeux rétro', 'Combien coûte la vanlife par mois'],
    },
  },
  {
    key: 'kids',
    kids: true,
    keywords: { en: ['toys', 'toy', 'unboxing', 'kids'], fr: ['jouets', 'jouet', 'deballage', 'enfants'] },
    names: { en: ['Tiny Tots Toy Time'], fr: ['Les Petits Jouets Rigolos'] },
    titles: {
      en: ['Surprise eggs toy unboxing for kids', 'Learn colours with toy cars', 'Toy kitchen pretend play'],
      fr: ['Déballage d\'œufs surprises pour enfants', 'Apprends les couleurs avec les petites voitures', 'On joue à la dînette'],
    },
  },
  {
    key: 'casino',
    keywords: { en: ['arcade', 'retro', 'slots'], fr: ['arcade', 'retro', 'machines'] },
    names: { en: ['Retro Reels Casino Wins'], fr: ['Jackpot Rétro Casino'] },
    titles: {
      en: ['Huge online slots win on a retro arcade themed casino', 'Casino bonus hunt: retro slots stream', 'Roulette strategy that works?'],
      fr: ['Gros gain aux machines à sous thème arcade rétro', 'Casino en ligne : chasse aux bonus', 'Stratégie roulette qui marche ?'],
    },
  },
  {
    key: 'cooking',
    keywords: { en: ['gadgets', 'kitchen', 'gift'], fr: ['gadgets', 'cuisine', 'cadeau'] },
    names: { en: ['Batch Cook Beth'], fr: ['La Popote de Lucie'] },
    titles: {
      en: ['Kitchen gadgets worth buying', 'Meal prep for the week', 'Slow cooker chilli', 'Is the air fryer overrated?'],
      fr: ['Les gadgets de cuisine qui valent le coup', 'Batch cooking de la semaine', 'Chili à la mijoteuse', 'Le airfryer est-il surcoté ?'],
    },
  },
]

function seeded(seed: number) {
  // mulberry32: small deterministic generator so the demo is the same every run
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface DemoChannel extends ChannelInfo {
  lang: 'en' | 'fr'
  theme: Theme
  videos: VideoInfo[]
}

function build(now: Date): DemoChannel[] {
  const rand = seeded(1982)
  const out: DemoChannel[] = []
  const subsLadder = [3_200, 14_500, 38_000, 61_000, 124_000, 410_000, 1_350_000]
  for (const theme of THEMES) {
    for (const lang of ['en', 'fr'] as const) {
      theme.names[lang].forEach((name, i) => {
        const n = out.length
        const id = `UCdemo${String(n).padStart(4, '0')}`
        const subscribers = n % 11 === 7 ? null : Math.round(subsLadder[(n * 3 + i) % subsLadder.length]! * (0.8 + rand() * 0.5))
        const handle = plain(name).replace(/[^a-z0-9]+/g, '')
        // One channel in nine has views far below its follower count, to show the warning.
        const viewRate = n % 9 === 4 ? 0.003 : 0.04 + rand() * 0.2
        const dormant = n % 13 === 6
        const count = 12 + Math.floor(rand() * 8)
        const videos: VideoInfo[] = Array.from({ length: count }, (_, v) => {
          const daysAgo = (dormant ? 200 : 3) + v * (4 + Math.floor(rand() * 9))
          const title = theme.titles[lang][(v + i) % theme.titles[lang].length]!
          return {
            id: `demo${n}v${v}`,
            title,
            description: v === 0 && n % 3 !== 2 ? `Follow me: https://www.instagram.com/${handle} and https://www.tiktok.com/@${handle}` : '',
            publishedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
            views: subscribers == null ? Math.round(2000 + rand() * 9000) : Math.round(subscribers * viewRate * (0.5 + rand())),
            language: lang,
            madeForKids: Boolean(theme.kids),
          }
        })
        out.push({
          id,
          title: `${name} (demo)`,
          description: `${theme.titles[lang].slice(0, 2).join('. ')}. ${n % 3 !== 2 ? `Instagram: https://www.instagram.com/${handle}` : ''}\nInvented channel for demo mode.`,
          handle: `${handle}demo`,
          country: n % 5 === 3 ? null : lang === 'en' ? 'GB' : 'FR',
          defaultLanguage: n % 4 === 1 ? null : lang,
          subscribers,
          uploadsPlaylistId: `UUdemo${String(n).padStart(4, '0')}`,
          madeForKids: Boolean(theme.kids),
          lang,
          theme,
          videos,
        })
      })
    }
  }
  return out
}

export function createDemoYouTubeClient(now: () => Date = () => new Date()): YouTubeClient {
  const channels = build(now())
  return {
    source: 'Demo data (invented, not real numbers)',
    async searchVideos({ q, relevanceLanguage, maxResults }): Promise<SearchHit[]> {
      const lang = relevanceLanguage === 'fr' ? 'fr' : 'en'
      const query = plain(q)
      const hits: SearchHit[] = []
      for (const ch of channels) {
        if (ch.lang !== lang) continue
        if (!ch.theme.keywords[lang].some(k => query.includes(plain(k)))) continue
        const words = query.split(/\s+/).filter(w => w.length > 2)
        const video = ch.videos.find(v => words.some(w => plain(v.title).includes(w))) ?? ch.videos[0]!
        hits.push({ videoId: video.id, channelId: ch.id, channelTitle: ch.title, title: video.title, publishedAt: video.publishedAt })
      }
      return hits.slice(0, maxResults)
    },
    async getChannels(ids): Promise<ChannelInfo[]> {
      return channels.filter(c => ids.includes(c.id)).map(({ lang: _l, theme: _t, videos: _v, ...info }) => info)
    },
    async getChannelByHandle(handle): Promise<ChannelInfo | null> {
      const found = channels.find(c => c.handle === handle.replace(/^@/, '').toLowerCase())
      if (!found) return null
      const { lang: _l, theme: _t, videos: _v, ...info } = found
      return info
    },
    async getRecentUploads(playlistId, max): Promise<VideoInfo[]> {
      return channels.find(c => c.uploadsPlaylistId === playlistId)?.videos.slice(0, max) ?? []
    },
  }
}

/** Stands in for Claude in demo mode. It only counts keyword matches, and says so. */
export function createDemoScorer(): Scorer {
  return {
    source: 'demo-heuristic',
    async score({ brief, channel, recentTitles, evidenceTitles }) {
      const words = [...brief.niches, ...brief.products].flatMap(t => plain(t).split(/\s+/)).filter(w => w.length > 3)
      const titles = [...recentTitles, ...evidenceTitles].map(plain)
      const matched = titles.filter(t => words.some(w => t.includes(w))).length
      const share = titles.length ? matched / titles.length : 0
      const text = plain([channel.name, channel.description, ...titles].join(' '))
      const gambling = /casino|roulette|machines a sous|slots/.test(text)
      const niches = brief.niches.filter(n => plain(n).split(/\s+/).some(w => w.length > 3 && text.includes(w)))
      return {
        fit_score: gambling ? 1 : share > 0.6 ? 5 : share > 0.4 ? 4 : share > 0.2 ? 3 : share > 0.05 ? 2 : 1,
        reason: `Demo score: ${matched} of ${titles.length} titles mention the brief's niches or products. Claude writes real reasons in live mode.`,
        niches,
        warnings: channel.madeForKids ? ['Audience looks mainly children'] : [],
        gambling_or_casino: gambling,
        creator_country_estimate: channel.declaredCountry ? null : /[éèàç]| les | des /.test(` ${channel.description} ${recentTitles.join(' ')} `.toLowerCase()) ? 'FR' : 'GB',
        creator_language_estimate: null,
        estimate_note: null,
      }
    },
  }
}
