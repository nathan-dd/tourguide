import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { tourSchema } from './schema.js';

export function createTourJsonSchema() {
  return zodToJsonSchema(tourSchema, {
    name: 'TourguideTour',
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });
}

export function writeTourJsonSchema(outputPath: string): void {
  const schema = createTourJsonSchema();
  writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
}

const thisFilePath = fileURLToPath(import.meta.url);
const thisFileName = process.argv[1] ? resolve(process.argv[1]) : '';

if (thisFilePath === thisFileName) {
  const outputPath = resolve(dirname(thisFilePath), '../tourguide.schema.json');
  writeTourJsonSchema(outputPath);
}
