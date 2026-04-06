import type { z } from 'zod';
import type {
  annotationCategorySchema,
  annotationSchema,
  chapterSchema,
  codebaseTourSchema,
  connectionSchema,
  connectionTypeSchema,
  diffTourSchema,
  fileMapEntrySchema,
  fileRelevanceSchema,
  overviewSchema,
  positionSchema,
  rangeSchema,
  stepKindSchema,
  stepSchema,
  tourSchema,
} from './schema.js';

export type Position = z.infer<typeof positionSchema>;
export type Range = z.infer<typeof rangeSchema>;
export type ConnectionType = z.infer<typeof connectionTypeSchema>;
export type StepKind = z.infer<typeof stepKindSchema>;
export type AnnotationCategory = z.infer<typeof annotationCategorySchema>;
export type FileRelevance = z.infer<typeof fileRelevanceSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type FileMapEntry = z.infer<typeof fileMapEntrySchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type DiffTour = z.infer<typeof diffTourSchema>;
export type CodebaseTour = z.infer<typeof codebaseTourSchema>;
export type Tour = z.infer<typeof tourSchema>;
