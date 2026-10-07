import type { Course, Room, ScheduleData, Section, Teacher, TeacherBlockedSlot, SlotRef, TimeSlot, WeekDayInfo } from './types';
import { slotKey } from './types';

/**
 * Immutable reference data with O(1) lookups.
 * Built once after the data is loaded; lessons live separately in the store.
 */
export interface Catalog {
  weekDays: WeekDayInfo[];
  timeSlots: TimeSlot[];
  sections: Section[];
  teachers: Teacher[];
  rooms: Room[];
  sectionsById: Map<string, Section>;
  coursesById: Map<string, Course>;
  teachersById: Map<string, Teacher>;
  roomsById: Map<string, Room>;
  timeSlotsById: Map<string, TimeSlot>;
  /** key: `${teacherId}|${day}:${timeSlotId}` */
  blocked: Map<string, TeacherBlockedSlot>;
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));

export const blockedKey = (teacherId: string, slot: SlotRef) => `${teacherId}|${slotKey(slot)}`;

export function buildCatalog(data: ScheduleData): Catalog {
  return {
    weekDays: data.meta.weekDays,
    timeSlots: data.timeSlots,
    sections: data.sections,
    teachers: data.teachers,
    rooms: data.rooms,
    sectionsById: byId(data.sections),
    coursesById: byId(data.courses),
    teachersById: byId(data.teachers),
    roomsById: byId(data.rooms),
    timeSlotsById: byId(data.timeSlots),
    blocked: new Map(data.teacherBlockedSlots.map((b) => [blockedKey(b.teacherId, b), b])),
  };
}

export const teacherName = (c: Catalog, id: string | null | undefined) =>
  (id && c.teachersById.get(id)?.shortName) || '—';
export const roomName = (c: Catalog, id: string) => c.roomsById.get(id)?.name ?? id;
export const sectionCode = (c: Catalog, id: string) => c.sectionsById.get(id)?.code ?? id;
export const courseOf = (c: Catalog, sectionId: string) => {
  const s = c.sectionsById.get(sectionId);
  return s ? c.coursesById.get(s.courseId) : undefined;
};
export const dayLabel = (c: Catalog, day: string) => c.weekDays.find((d) => d.id === day)?.label ?? day;
export const slotLabel = (c: Catalog, slot: SlotRef) => {
  const t = c.timeSlotsById.get(slot.timeSlotId);
  return `${dayLabel(c, slot.day)}, ${t ? t.start : slot.timeSlotId}`;
};
