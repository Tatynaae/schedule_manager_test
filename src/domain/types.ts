export type {
  WeekDay,
  RoomType,
  TimeSlot,
  Course,
  Teacher,
  Room,
  Section,
  TeacherBlockedSlot,
  Lesson,
} from '../../types';

import type {
  Course,
  Lesson,
  Room,
  Section,
  Teacher,
  TeacherBlockedSlot,
  TimeSlot,
  WeekDay,
} from '../../types';

export interface WeekDayInfo {
  id: WeekDay;
  label: string;
}

/** Shape of `schedule-mock-data.json` / the mock API response. */
export interface ScheduleData {
  meta: { title: string; version: number; weekDays: WeekDayInfo[] };
  timeSlots: TimeSlot[];
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
  sections: Section[];
  teacherBlockedSlots: TeacherBlockedSlot[];
  lessons: Lesson[];
}

/** A grid cell: one day × one time slot. */
export interface SlotRef {
  day: WeekDay;
  timeSlotId: string;
}

/** Lesson without identity — what we validate before creating/updating. */
export type LessonDraft = Omit<Lesson, 'id'>;

export type IssueCode =
  | 'TEACHER_BUSY'
  | 'TEACHER_BLOCKED'
  | 'TEACHER_NOT_ALLOWED'
  | 'NO_TEACHER'
  | 'ROOM_BUSY'
  | 'ROOM_CAPACITY'
  | 'NO_ROOM'
  | 'SECTION_BUSY'
  | 'SECTION_COMPLETE'
  | 'ROOM_TYPE_MISMATCH';

export interface Issue {
  code: IssueCode;
  /** `error` blocks the action, `warning` is informational. */
  severity: 'error' | 'warning';
  message: string;
}

export const slotKey = (slot: SlotRef) => `${slot.day}:${slot.timeSlotId}`;
