import type { Section } from './types';

export type ProgressStatus = 'none' | 'partial' | 'complete';

export interface SectionProgress {
  placed: number;
  required: number;
  remaining: number;
  status: ProgressStatus;
}

export function sectionProgress(section: Section, placed: number): SectionProgress {
  const required = section.requiredLessonsPerWeek;
  return {
    placed,
    required,
    remaining: Math.max(0, required - placed),
    status: placed === 0 ? 'none' : placed >= required ? 'complete' : 'partial',
  };
}
