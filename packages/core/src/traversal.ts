import type { Chapter, Step, Tour } from '@tourguide/format';

export type TourPosition = {
  chapterIndex: number;
  stepIndex: number;
};

export type TourProgress = {
  chapter: { current: number; total: number };
  chapterStep: { current: number; total: number };
  overallStep: { current: number; total: number };
};

export function firstPosition(_tour: Tour): TourPosition {
  return { chapterIndex: 0, stepIndex: 0 };
}

export function lastPosition(tour: Tour): TourPosition {
  const chapterIndex = Math.max(0, tour.chapters.length - 1);
  const stepIndex = Math.max(0, tour.chapters[chapterIndex]?.steps.length - 1);
  return { chapterIndex, stepIndex };
}

export function getChapter(tour: Tour, position: TourPosition): Chapter {
  return tour.chapters[position.chapterIndex];
}

export function getStep(tour: Tour, position: TourPosition): Step {
  return getChapter(tour, position).steps[position.stepIndex];
}

function positionForStepOffset(tour: Tour, offset: number): TourPosition | null {
  const total = totalSteps(tour);
  if (offset < 0 || offset >= total) {
    return null;
  }

  let remaining = offset;
  for (let chapterIndex = 0; chapterIndex < tour.chapters.length; chapterIndex += 1) {
    const stepCount = tour.chapters[chapterIndex].steps.length;
    if (remaining < stepCount) {
      return { chapterIndex, stepIndex: remaining };
    }
    remaining -= stepCount;
  }
  return null;
}

function globalStepOffset(tour: Tour, position: TourPosition): number {
  let offset = 0;
  for (let chapterIndex = 0; chapterIndex < position.chapterIndex; chapterIndex += 1) {
    offset += tour.chapters[chapterIndex].steps.length;
  }
  return offset + position.stepIndex;
}

export function nextStep(tour: Tour, position: TourPosition): TourPosition | null {
  return positionForStepOffset(tour, globalStepOffset(tour, position) + 1);
}

export function prevStep(tour: Tour, position: TourPosition): TourPosition | null {
  return positionForStepOffset(tour, globalStepOffset(tour, position) - 1);
}

export function nextChapter(tour: Tour, position: TourPosition): TourPosition | null {
  const chapterIndex = position.chapterIndex + 1;
  if (chapterIndex >= tour.chapters.length) {
    return null;
  }
  return { chapterIndex, stepIndex: 0 };
}

export function prevChapter(tour: Tour, position: TourPosition): TourPosition | null {
  const chapterIndex = position.chapterIndex - 1;
  if (chapterIndex < 0) {
    return null;
  }
  return { chapterIndex, stepIndex: 0 };
}

export function totalSteps(tour: Tour): number {
  return tour.chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
}

export function getProgress(tour: Tour, position: TourPosition): TourProgress {
  return {
    chapter: {
      current: position.chapterIndex + 1,
      total: tour.chapters.length,
    },
    chapterStep: {
      current: position.stepIndex + 1,
      total: getChapter(tour, position).steps.length,
    },
    overallStep: {
      current: globalStepOffset(tour, position) + 1,
      total: totalSteps(tour),
    },
  };
}
