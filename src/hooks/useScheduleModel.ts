import { useSelector } from '@tanstack/react-store';
import { useMemo } from 'react';
import { countBySection, indexBySlot } from '../domain/lessonIndex';
import type { ValidationContext } from '../domain/validation';
import { scheduleStore } from '../store/scheduleStore';
import { useCatalog } from './catalogContext';

/** Lessons + derived indexes. Recomputed only when the lessons array changes. */
export function useScheduleModel() {
  const catalog = useCatalog();
  const lessons = useSelector(scheduleStore, (s) => s.lessons);
  return useMemo(() => {
    const ctx: ValidationContext = {
      catalog,
      bySlot: indexBySlot(lessons),
      placedBySection: countBySection(lessons),
    };
    const lessonsById = new Map(lessons.map((l) => [l.id, l]));
    return { lessons, lessonsById, ctx };
  }, [catalog, lessons]);
}

export type ScheduleModel = ReturnType<typeof useScheduleModel>;
