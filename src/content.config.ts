import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const dimensionsSchema = z.object({
  supportH: z.number().nullable().optional(),
  supportW: z.number().nullable().optional(),
  imageH: z.number().nullable().optional(),
  imageW: z.number().nullable().optional(),
}).optional().nullable();

const imagesSchema = z.object({
  display: z.array(z.string()).default([]),
  recto: z.array(z.string()).default([]),
  verso: z.array(z.string()).default([]),
  plateSig: z.array(z.string()).default([]),
  handSig: z.array(z.string()).default([]),
  watermark: z.array(z.string()).default([]),
  other: z.array(z.string()).default([]),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/works' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    titleAlt: z.string().optional().nullable(),
    titleTrans: z.string().optional().nullable(),
    artist: z.string(),
    artistLife: z.string().optional().nullable(),
    after: z.array(z.string()).default([]),
    medium: z.array(z.string()).default([]),
    support: z.string().optional().nullable(),
    marks: z.array(z.string()).default([]),
    yearCreated: z.string(),
    yearPrinted: z.string().optional().nullable(),
    sortYear: z.number(),
    yearAcquired: z.number().optional().nullable(),
    handSig: z.boolean().default(false),
    plateSig: z.boolean().default(false),
    dimensions: dimensionsSchema,
    catalogue: z.string().optional().nullable(),
    catNum: z.string().optional().nullable(),
    catPage: z.number().optional().nullable(),
    focus: z.array(z.string()).default([]),
    images: imagesSchema,
  }),
});

export const collections = { works };
