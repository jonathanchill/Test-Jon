import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    summary: z.string(),
    category: z.enum(['AI', 'Digital']),
    services: z.array(z.string()),
    sector: z.string(),
    year: z.number(),
    results: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    featured: z.boolean().default(false),
    placeholder: z.boolean().default(false),
    order: z.number().default(99),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    readingTime: z.number(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, insights };
