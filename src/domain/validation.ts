import type { Catalog } from './catalog';
import { roomName, sectionCode, teacherName } from './catalog';
import { blockedKey } from './catalog';
import type { LessonsBySlot } from './lessonIndex';
import { lessonsIn } from './lessonIndex';
import type { Issue, Lesson, LessonDraft, Room, Section, SlotRef } from './types';

/**
 * Pure scheduling rules. Nothing here knows about React or drag & drop:
 * UI asks "what happens if X goes to slot Y?" and renders the answer.
 */
export interface ValidationContext {
  catalog: Catalog;
  bySlot: LessonsBySlot;
  placedBySection: Map<string, number>;
}

const error = (code: Issue['code'], message: string): Issue => ({ code, severity: 'error', message });
const warning = (code: Issue['code'], message: string): Issue => ({ code, severity: 'warning', message });

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
export const errorsOf = (issues: Issue[]) => issues.filter((i) => i.severity === 'error');

export function teacherIssues(
  teacherId: string,
  slot: SlotRef,
  ctx: ValidationContext,
  ignoreLessonId?: string,
): Issue[] {
  const { catalog } = ctx;
  const issues: Issue[] = [];
  const name = teacherName(catalog, teacherId);
  const blocked = catalog.blocked.get(blockedKey(teacherId, slot));
  if (blocked) {
    issues.push(error('TEACHER_BLOCKED', `${name} — ${blocked.reason.toLowerCase()} в это время`));
  }
  const busy = lessonsIn(ctx.bySlot, slot, ignoreLessonId).find((l) => l.teacherId === teacherId);
  if (busy) {
    issues.push(error('TEACHER_BUSY', `${name} уже ведёт ${sectionCode(catalog, busy.sectionId)} в это время`));
  }
  return issues;
}

export function roomIssues(
  roomId: string,
  studentsCount: number,
  slot: SlotRef,
  ctx: ValidationContext,
  ignoreLessonId?: string,
): Issue[] {
  const { catalog } = ctx;
  const room = catalog.roomsById.get(roomId);
  if (!room) return [error('NO_ROOM', 'Аудитория не выбрана')];
  const issues: Issue[] = [];
  const busy = lessonsIn(ctx.bySlot, slot, ignoreLessonId).find((l) => l.roomId === roomId);
  if (busy) {
    issues.push(error('ROOM_BUSY', `Аудитория ${room.name} занята: ${sectionCode(catalog, busy.sectionId)}`));
  }
  if (room.capacity < studentsCount) {
    issues.push(
      error('ROOM_CAPACITY', `В ${room.name} ${room.capacity} мест, а студентов ${studentsCount}`),
    );
  }
  return issues;
}

export function sectionSlotIssues(
  sectionId: string,
  slot: SlotRef,
  ctx: ValidationContext,
  ignoreLessonId?: string,
): Issue[] {
  const clash = lessonsIn(ctx.bySlot, slot, ignoreLessonId).some((l) => l.sectionId === sectionId);
  return clash
    ? [error('SECTION_BUSY', `У ${sectionCode(ctx.catalog, sectionId)} уже есть занятие в это время`)]
    : [];
}

/** Full check of a concrete lesson (teacher, room, slot are all known). */
export function validateDraft(draft: LessonDraft, ctx: ValidationContext, ignoreLessonId?: string): Issue[] {
  const section = ctx.catalog.sectionsById.get(draft.sectionId);
  if (!section) return [error('NO_TEACHER', 'Неизвестная секция')];
  const issues: Issue[] = [
    ...sectionSlotIssues(section.id, draft, ctx, ignoreLessonId),
    ...(draft.teacherId
      ? teacherIssues(draft.teacherId, draft, ctx, ignoreLessonId)
      : [error('NO_TEACHER', 'Преподаватель не выбран')]),
    ...roomIssues(draft.roomId, section.studentsCount, draft, ctx, ignoreLessonId),
  ];
  if (draft.teacherId && !section.allowedTeacherIds.includes(draft.teacherId)) {
    issues.push(
      error('TEACHER_NOT_ALLOWED', `${teacherName(ctx.catalog, draft.teacherId)} не может вести ${section.code}`),
    );
  }
  const room = ctx.catalog.roomsById.get(draft.roomId);
  if (room && room.type !== section.preferredRoomType) {
    issues.push(
      warning(
        'ROOM_TYPE_MISMATCH',
        section.preferredRoomType === 'COMPUTER_LAB'
          ? 'Секции нужен компьютерный класс'
          : 'Секция рассчитана на лекционную аудиторию',
      ),
    );
  }
  return issues;
}

/** Errors of an already placed lesson against the rest of the schedule. */
export const lessonErrors = (lesson: Lesson, ctx: ValidationContext) =>
  errorsOf(validateDraft(lesson, ctx, lesson.id));

export interface RoomOption {
  room: Room;
  issues: Issue[];
  available: boolean;
}

/**
 * All rooms for a section in a slot, best first:
 * available → preferred type → smallest sufficient capacity (keeps big halls free).
 */
export function rankRooms(
  section: Section,
  slot: SlotRef,
  ctx: ValidationContext,
  ignoreLessonId?: string,
): RoomOption[] {
  return ctx.catalog.rooms
    .map((room) => {
      const issues = roomIssues(room.id, section.studentsCount, slot, ctx, ignoreLessonId);
      return { room, issues, available: !hasErrors(issues) };
    })
    .sort(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        Number(b.room.type === section.preferredRoomType) - Number(a.room.type === section.preferredRoomType) ||
        a.room.capacity - b.room.capacity,
    );
}

export const pickRoom = (section: Section, slot: SlotRef, ctx: ValidationContext, ignoreLessonId?: string) =>
  rankRooms(section, slot, ctx, ignoreLessonId).find((o) => o.available)?.room;

function noRoomIssue(section: Section, ctx: ValidationContext): Issue {
  const fits = ctx.catalog.rooms.some((r) => r.capacity >= section.studentsCount);
  return error(
    'NO_ROOM',
    fits
      ? `Все аудитории на ${section.studentsCount}+ мест заняты`
      : `Нет аудитории вместимостью от ${section.studentsCount} мест`,
  );
}

export type DropPlan =
  | { status: 'ok'; draft: LessonDraft; warnings: Issue[]; needsReview: boolean }
  | { status: 'invalid'; issues: Issue[] }
  | { status: 'same' };

/** Section dragged from the list onto a slot: pick teacher and room automatically. */
export function planSectionDrop(sectionId: string, slot: SlotRef, ctx: ValidationContext): DropPlan {
  const { catalog } = ctx;
  const section = catalog.sectionsById.get(sectionId);
  if (!section) return { status: 'invalid', issues: [error('NO_TEACHER', 'Неизвестная секция')] };

  const placed = ctx.placedBySection.get(section.id) ?? 0;
  if (placed >= section.requiredLessonsPerWeek) {
    return {
      status: 'invalid',
      issues: [error('SECTION_COMPLETE', `Все ${section.requiredLessonsPerWeek} занятия ${section.code} уже распределены`)],
    };
  }

  const sectionBusy = sectionSlotIssues(section.id, slot, ctx);
  if (sectionBusy.length) return { status: 'invalid', issues: sectionBusy };

  const candidates = section.teacherId ? [section.teacherId] : section.allowedTeacherIds;
  if (!candidates.length) {
    return { status: 'invalid', issues: [error('NO_TEACHER', `Для ${section.code} нет допустимых преподавателей`)] };
  }
  const teacherChecks = candidates.map((id) => ({ id, issues: teacherIssues(id, slot, ctx) }));
  const teacher = teacherChecks.find((t) => t.issues.length === 0);
  if (!teacher) return { status: 'invalid', issues: teacherChecks.flatMap((t) => t.issues) };

  const room = pickRoom(section, slot, ctx);
  if (!room) return { status: 'invalid', issues: [noRoomIssue(section, ctx)] };

  const draft: LessonDraft = { sectionId: section.id, teacherId: teacher.id, roomId: room.id, ...slot };
  return {
    status: 'ok',
    draft,
    warnings: validateDraft(draft, ctx).filter((i) => i.severity === 'warning'),
    // Teacher was chosen by us, not by the section — let the user confirm it.
    needsReview: section.teacherId === null && candidates.length > 1,
  };
}

/** Existing lesson dragged to another slot: teacher and room stay the same. */
export function planLessonMove(lesson: Lesson, slot: SlotRef, ctx: ValidationContext): DropPlan {
  if (lesson.day === slot.day && lesson.timeSlotId === slot.timeSlotId) return { status: 'same' };
  const draft: LessonDraft = { ...lesson, ...slot };
  const issues = validateDraft(draft, ctx, lesson.id);
  if (hasErrors(issues)) {
    const section = ctx.catalog.sectionsById.get(lesson.sectionId);
    const roomBusy = issues.some((i) => i.code === 'ROOM_BUSY');
    const alternative = roomBusy && section ? pickRoom(section, slot, ctx, lesson.id) : undefined;
    return {
      status: 'invalid',
      issues: issues.map((i) =>
        i.code === 'ROOM_BUSY' && alternative
          ? { ...i, message: `${i.message}. Свободна ${roomName(ctx.catalog, alternative.id)} — смените аудиторию в карточке занятия` }
          : i,
      ),
    };
  }
  return { status: 'ok', draft, warnings: issues, needsReview: false };
}
