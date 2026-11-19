import type { Brief, Db, TermExpander } from './types'

export interface PlannedSearch {
  kind: 'product' | 'niche'
  term: string
  niche: string | null
  region: string
  language: string
  term_source: 'brief' | 'claude' | 'person'
}

// Which languages are searched in which country. A country not listed here is
// searched in every language on the brief.
const COUNTRY_LANGUAGES: Record<string, string[]> = {
  GB: ['en'], IE: ['en'], US: ['en'], AU: ['en'], NZ: ['en'],
  FR: ['fr'], DE: ['de'], AT: ['de'], ES: ['es'], IT: ['it'], NL: ['nl'], PT: ['pt'],
  BE: ['fr', 'nl'], CH: ['de', 'fr', 'it'], CA: ['en', 'fr'], LU: ['fr', 'de'],
  SE: ['sv'], DK: ['da'], NO: ['no'], FI: ['fi'], PL: ['pl'],
}

export function languagesFor(country: string, briefLanguages: string[]): string[] {
  const known = COUNTRY_LANGUAGES[country.toUpperCase()]
  if (!known) return briefLanguages
  const wanted = known.filter(l => briefLanguages.includes(l))
  return wanted.length ? wanted : briefLanguages
}

function clean(term: string): string {
  return term.replace(/\s+/g, ' ').trim()
}

/**
 * The search plan for a brief. Product searches come first: anyone who has
 * already covered a similar product is the best prospect. Then each niche in
 * each country and language. `terms` are the per-language search terms; when
 * Claude has not supplied any, the brief's own words are used as written.
 */
export function buildPlan(brief: Brief, terms: { kind: 'product' | 'niche', niche: string | null, language: string, term: string }[] = []): PlannedSearch[] {
  const out: PlannedSearch[] = []
  const seen = new Set<string>()
  const add = (p: PlannedSearch) => {
    const term = clean(p.term)
    if (!term) return
    const key = `${term.toLowerCase()}|${p.region}|${p.language}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ ...p, term })
  }

  for (const kind of ['product', 'niche'] as const) {
    const own = kind === 'product' ? brief.products : brief.niches
    for (const country of brief.countries) {
      const region = country.toUpperCase()
      for (const language of languagesFor(region, brief.languages)) {
        // The brief's own words first: product names are the same in every language.
        for (const word of own) add({ kind, term: word, niche: kind === 'niche' ? word : null, region, language, term_source: 'brief' })
        for (const t of terms) {
          if (t.kind === kind && t.language === language) add({ kind, term: t.term, niche: t.niche, region, language, term_source: 'claude' })
        }
      }
    }
  }
  return out
}

export async function savePlan(db: Db, briefId: number, plan: PlannedSearch[]): Promise<number> {
  let added = 0
  for (const p of plan) {
    const res = await db.query(
      `insert into searches (brief_id, kind, term, niche, region, language, term_source)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
      [briefId, p.kind, p.term, p.niche, p.region, p.language, p.term_source],
    )
    added += res.rowCount ?? 0
  }
  return added
}

/** Builds and stores the plan. If Claude is unavailable the brief's own words are still searched. */
export async function planBrief(db: Db, brief: Brief, expander: TermExpander | null): Promise<{ added: number, note: string }> {
  let terms: Awaited<ReturnType<TermExpander['expand']>> = []
  let note = ''
  if (expander) {
    try {
      terms = await expander.expand(brief)
    } catch (err) {
      note = `Search terms were not expanded by Claude (${err instanceof Error ? err.message : 'error'}). The brief's own words are used.`
    }
  } else {
    note = 'Claude is not set up, so the brief\'s own words are used as search terms. Add terms by hand for other languages.'
  }
  const added = await savePlan(db, brief.id, buildPlan(brief, terms))
  return { added, note }
}
