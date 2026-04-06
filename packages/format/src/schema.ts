import { z } from 'zod';

export const positionSchema = z.object({
  line: z.number().int().min(1),
  character: z.number().int().min(0),
});

export const rangeSchema = z.object({
  start: positionSchema,
  end: positionSchema,
});

export const connectionTypeSchema = z.enum([
  'calls',
  'imports',
  'configures',
  'tests',
  'triggers',
  'inherits',
  'returns-to',
]);

export const stepKindSchema = z.enum([
  'entry-point',
  'model',
  'handler',
  'serializer',
  'config',
  'side-effect',
  'test',
  'migration',
  'utility',
  'type-definition',
]);

export const annotationCategorySchema = z.enum([
  'modified',
  'entry-point',
  'data-flow',
  'side-effect',
  'context',
]);

export const fileRelevanceSchema = z.enum(['primary', 'secondary', 'context']);

export const connectionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: connectionTypeSchema,
  description: z.string().min(1).optional(),
});

export const annotationSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  range: rangeSchema,
  pattern: z.string().min(1).optional(),
  content: z.string().min(1),
  kind: stepKindSchema,
  category: annotationCategorySchema,
});

export const stepSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  range: rangeSchema,
  pattern: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: stepKindSchema,
  chapter: z.string().min(1),
  connections: z.array(connectionSchema),
  annotationRefs: z.array(z.string().min(1)),
});

export const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  steps: z.array(stepSchema),
});

export const fileMapEntrySchema = z.object({
  file: z.string().min(1),
  description: z.string().min(1),
  relevance: fileRelevanceSchema,
});

export const overviewSchema = z.object({
  summary: z.string().min(1),
  diagram: z.string().min(1).optional(),
  fileMap: z.array(fileMapEntrySchema),
});

export const generatedBySchema = z
  .object({
    tool: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .optional();

const tourBaseSchema = z.object({
  $schema: z.string().min(1).optional(),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  overview: overviewSchema,
  chapters: z.array(chapterSchema),
  annotations: z.array(annotationSchema),
  connections: z.array(connectionSchema),
  generatedBy: generatedBySchema,
});

export const diffTourSchema = tourBaseSchema.extend({
  mode: z.literal('diff'),
  baseRef: z.string().min(1),
  headRef: z.string().min(1),
});

export const codebaseTourSchema = tourBaseSchema.extend({
  mode: z.literal('codebase'),
  ref: z.string().min(1).optional(),
});

export const tourSchema = z.discriminatedUnion('mode', [diffTourSchema, codebaseTourSchema]);
