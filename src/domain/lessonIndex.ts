import type { Lesson, SlotRef } from './types';
import { slotKey } from './types';

/** Lessons grouped by grid cell — the hot lookup for every validation. */
export type LessonsBySlot = Map<string, Lesson[]>;

export function indexBySlot(lessons: Lesson[]): LessonsBySlot {
  const map: LessonsBySlot = new Map();
  for (const l of lessons) {
    const key = slotKey(l);
    const list = map.get(key);
    if (list) list.push(l);
    else map.set(key, [l]);
  }
  return map;
}

export function countBySection(lessons: Lesson[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lessons) map.set(l.sectionId, (map.get(l.sectionId) ?? 0) + 1);
  return map;
}

export const lessonsIn = (index: LessonsBySlot, slot: SlotRef, ignoreLessonId?: string) =>
  (index.get(slotKey(slot)) ?? []).filter((l) => l.id !== ignoreLessonId);
