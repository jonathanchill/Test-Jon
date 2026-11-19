import { z } from 'zod'

const list = (max: number) => z.array(z.string().trim().min(1).max(200)).max(max).transform(a => [...new Set(a)])

export const BriefInput = z.object({
  client: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  niches: list(20).refine(a => a.length > 0, 'Give at least one niche'),
  countries: z.array(z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use two-letter country codes such as GB or FR').transform(s => s.toUpperCase())).min(1).max(12),
  languages: z.array(z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use two-letter language codes such as en or fr').transform(s => s.toLowerCase())).min(1).max(8),
  follower_min: z.number().int().min(0).max(100_000_000).default(10_000),
  follower_max: z.number().int().min(1).max(1_000_000_000).nullable().default(null),
  products: list(30).default([]),
  exclusions: list(500).default([]),
  notes: z.string().trim().max(4000).default(''),
}).refine(b => b.follower_max == null || b.follower_max > b.follower_min, { message: 'The top of the follower range must be above the bottom', path: ['follower_max'] })

export type BriefInput = z.infer<typeof BriefInput>

export const ReviewInput = z.object({
  status: z.enum(['found', 'shortlisted', 'approved', 'rejected']).optional(),
  fit_score: z.number().int().min(1).max(5).optional(),
  reason: z.string().trim().max(500).optional(),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  niches: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  review_note: z.string().trim().max(1000).optional(),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(s => s.toUpperCase()).nullable().optional(),
  clear_exclusion: z.literal(true).optional(),
})
