import { tourSchema } from './schema.js';
import type { Connection, Tour } from './types.js';

export type ValidationError = {
  path: string;
  message: string;
  code: string;
};

export type ValidationWarning = {
  path: string;
  message: string;
  code: string;
};

export type ValidationSuccess = {
  success: true;
  tour: Tour;
  warnings: ValidationWarning[];
};

export type ValidationFailure = {
  success: false;
  errors: ValidationError[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

function flattenPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return '$';
  }
  return path
    .map((part) => (typeof part === 'number' ? `[${part}]` : part))
    .join('.')
    .replace('.[', '[');
}

function versionWarnings(tour: Tour): ValidationWarning[] {
  if (tour.version.startsWith('1.')) {
    return [];
  }
  return [
    {
      path: 'version',
      message: `Expected a 1.x version, received "${tour.version}"`,
      code: 'version-mismatch',
    },
  ];
}

function referentialErrors(tour: Tour): ValidationError[] {
  const errors: ValidationError[] = [];
  const chapterIds = new Set(tour.chapters.map((chapter) => chapter.id));
  const annotationIds = new Set(tour.annotations.map((annotation) => annotation.id));
  const stepIds = new Set(tour.chapters.flatMap((chapter) => chapter.steps.map((step) => step.id)));
  const nodeIds = new Set([...stepIds, ...annotationIds]);

  for (const chapter of tour.chapters) {
    for (const step of chapter.steps) {
      if (!chapterIds.has(step.chapter)) {
        errors.push({
          path: `chapters.${chapter.id}.steps.${step.id}.chapter`,
          message: `Unknown chapter reference "${step.chapter}"`,
          code: 'unknown-chapter-reference',
        });
      }

      for (const annotationRef of step.annotationRefs) {
        if (!annotationIds.has(annotationRef)) {
          errors.push({
            path: `chapters.${chapter.id}.steps.${step.id}.annotationRefs`,
            message: `Unknown annotation reference "${annotationRef}"`,
            code: 'unknown-annotation-reference',
          });
        }
      }

      for (const connection of step.connections) {
        errors.push(
          ...invalidNodeErrors(
            connection,
            `chapters.${chapter.id}.steps.${step.id}.connections`,
            nodeIds,
          ),
        );
      }
    }
  }

  for (let index = 0; index < tour.connections.length; index += 1) {
    errors.push(...invalidNodeErrors(tour.connections[index], `connections[${index}]`, nodeIds));
  }

  return errors;
}

function invalidNodeErrors(
  connection: Connection,
  pathPrefix: string,
  nodeIds: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!nodeIds.has(connection.from)) {
    errors.push({
      path: `${pathPrefix}.from`,
      message: `Unknown connection source "${connection.from}"`,
      code: 'unknown-connection-source',
    });
  }
  if (!nodeIds.has(connection.to)) {
    errors.push({
      path: `${pathPrefix}.to`,
      message: `Unknown connection target "${connection.to}"`,
      code: 'unknown-connection-target',
    });
  }
  return errors;
}

export function validate(data: unknown): ValidationResult {
  const parsed = tourSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        path: flattenPath(issue.path),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  const tour = parsed.data;
  const errors = referentialErrors(tour);
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    tour,
    warnings: versionWarnings(tour),
  };
}
