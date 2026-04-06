import { describe, expect, it } from 'vitest';
import { createTourJsonSchema } from '../src/json-schema';

describe('createTourJsonSchema', () => {
  it('creates a json schema object with expected shape', () => {
    const schema = createTourJsonSchema();
    const root =
      schema.definitions && 'TourguideTour' in schema.definitions
        ? (schema.definitions.TourguideTour as Record<string, unknown>)
        : undefined;

    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema).toHaveProperty('definitions');
    expect(root).toHaveProperty('anyOf');
    expect(Array.isArray(root?.anyOf)).toBe(true);
  });
});
