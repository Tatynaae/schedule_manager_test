import rawData from '../../schedule-mock-data.json';
import type { ScheduleData, Section } from '../domain/types';

const data = rawData as ScheduleData;

let attempts = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dev knobs via URL, handy to demo states:
 *   ?fail=1          — the first request fails (error + retry UI), retry succeeds
 *   ?sections=300    — append generated sections to test a large list
 *   ?delay=2000      — custom latency
 */
function params() {
  const p = new URLSearchParams(window.location.search);
  return {
    fail: p.has('fail'),
    extraSections: Math.min(Number(p.get('sections')) || 0, 2000),
    delay: Number(p.get('delay')) || 500,
  };
}

function generateSections(count: number): Section[] {
  const out: Section[] = [];
  for (let i = 0; i < count; i++) {
    const base = data.sections[i % data.sections.length];
    out.push({
      ...base,
      id: `${base.id}_G${i}`,
      code: `${base.code.split('-')[0]}-${String(10 + Math.floor(i / data.sections.length)).padStart(2, '0')}`,
      studentsCount: 10 + ((i * 7) % 30),
      teacherId: i % 4 === 0 ? null : base.teacherId,
    });
  }
  return out;
}

export async function fetchSchedule(): Promise<ScheduleData> {
  const { fail, extraSections, delay } = params();
  await sleep(delay);
  if (fail && attempts++ === 0) throw new Error('Сервер расписания недоступен (mock: ?fail=1, попробуйте ещё раз)');
  // Deep copy: callers must never mutate the "server" data.
  const copy = structuredClone(data);
  if (extraSections) copy.sections.push(...generateSections(extraSections));
  return copy;
}

/** Identifies a dataset, so persisted lessons from another dataset are not reused. */
export const datasetKey = (d: ScheduleData) => `v${d.meta.version}:${d.sections.length}`;
