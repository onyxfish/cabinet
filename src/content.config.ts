import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const dimensionsSchema = z.object({
  supportH: z.coerce.number().nullable().optional(),
  supportW: z.coerce.number().nullable().optional(),
  imageH: z.coerce.number().nullable().optional(),
  imageW: z.coerce.number().nullable().optional(),
}).optional().nullable();

const imageSizeSchema = z.object({
  thumb: z.string(),
  display: z.string(),
  zoom: z.string(),
});

const imagesSchema = z.object({
  display: z.array(imageSizeSchema).default([]),
  recto: z.array(imageSizeSchema).default([]),
  verso: z.array(imageSizeSchema).default([]),
  plateSig: z.array(imageSizeSchema).default([]),
  handSig: z.array(imageSizeSchema).default([]),
  watermark: z.array(imageSizeSchema).default([]),
  other: z.array(imageSizeSchema).default([]),
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
    artistNationality: z.string().optional().nullable(),
    artistWikidataId: z.string().optional().nullable(),
    artistUlanId: z.string().optional().nullable(),
    artistRkdId: z.string().optional().nullable(),
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
