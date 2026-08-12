// Zod schema for the `conceitos` collection (contracts/content-schema.md §1). A file
// violating this schema fails the build rather than shipping broken SEO.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const conceitos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/conceitos' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().min(80).max(155),
    targetQuery: z.string().min(3),
    answer: z.string().max(320),
    updated: z.coerce.date(),
    published: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { conceitos };
