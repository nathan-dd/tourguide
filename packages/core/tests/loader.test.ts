import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TourLoadError, loadTour, parseTour } from '../src/loader';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('loader', () => {
  it('loads a valid tour from disk', async () => {
    const filePath = resolve(fixturesDir, 'sample.tourguide');
    const tour = await loadTour(filePath);
    expect(tour.title).toBe('Sample tour');
    expect(tour.chapters).toHaveLength(2);
  });

  it('parses raw json text', () => {
    const json = readFileSync(resolve(fixturesDir, 'minimal.tourguide'), 'utf8');
    const tour = parseTour(json);
    expect(tour.mode).toBe('codebase');
  });

  it('throws TourLoadError for invalid tour data', async () => {
    const filePath = resolve(fixturesDir, 'invalid.tourguide');
    await expect(loadTour(filePath)).rejects.toBeInstanceOf(TourLoadError);
  });

  it('throws for missing file', async () => {
    const filePath = resolve(fixturesDir, 'missing.tourguide');
    await expect(loadTour(filePath)).rejects.toBeInstanceOf(TourLoadError);
  });

  it('throws for malformed json', () => {
    const malformed = '{"title": "x",';
    expect(() => parseTour(malformed)).toThrow(TourLoadError);
  });
});
