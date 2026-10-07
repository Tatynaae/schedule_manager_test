import { describe, expect, it } from 'vitest';
import raw from '../../schedule-mock-data.json';
import { buildCatalog } from './catalog';
import { countBySection, indexBySlot } from './lessonIndex';
import type { Lesson, ScheduleData } from './types';
import { lessonErrors, pickRoom, planLessonMove, planSectionDrop, validateDraft, type ValidationContext } from './validation';

const data = raw as ScheduleData;
const catalog = buildCatalog(data);
const ctxFor = (lessons: Lesson[] = data.lessons): ValidationContext => ({
  catalog,
  bySlot: indexBySlot(lessons),
  placedBySection: countBySection(lessons),
});
const lesson = (id: string) => data.lessons.find((l) => l.id === id)!;
const codes = (plan: ReturnType<typeof planSectionDrop>) => (plan.status === 'invalid' ? plan.issues.map((i) => i.code) : []);

describe('initial mock data', () => {
  it('has no conflicts', () => {
    const ctx = ctxFor();
    expect(data.lessons.flatMap((l) => lessonErrors(l, ctx))).toEqual([]);
  });
});

describe('planSectionDrop', () => {
  it('creates a lesson in a free slot with the section teacher and a fitting room', () => {
    const plan = planSectionDrop('SEC_DB202_01', { day: 'MON', timeSlotId: 'SLOT_1130' }, ctxFor());
    expect(plan.status).toBe('ok');
    if (plan.status !== 'ok') return;
    expect(plan.draft.teacherId).toBe('T4');
    expect(plan.draft.roomId).toBe('LAB1'); // preferred COMPUTER_LAB, 18 seats for 18 students
    expect(plan.needsReview).toBe(false);
  });

  it('rejects a slot where the teacher is already teaching', () => {
    // T1 teaches CS101-01 on MON 08:30; CS205-01 is also T1.
    expect(codes(planSectionDrop('SEC_CS205_01', { day: 'MON', timeSlotId: 'SLOT_0830' }, ctxFor()))).toContain('TEACHER_BUSY');
  });

  it('rejects a slot blocked for the teacher', () => {
    expect(codes(planSectionDrop('SEC_MATH201_01', { day: 'MON', timeSlotId: 'SLOT_0830' }, ctxFor()))).toContain('TEACHER_BLOCKED');
  });

  it('rejects a slot where the section already has a lesson', () => {
    expect(codes(planSectionDrop('SEC_CS101_01', { day: 'WED', timeSlotId: 'SLOT_1000' }, ctxFor()))).toEqual(['SECTION_BUSY']);
  });

  it('rejects a fully distributed section', () => {
    const extra: Lesson = { ...lesson('L4'), id: 'X', day: 'FRI', timeSlotId: 'SLOT_0830' };
    expect(codes(planSectionDrop('SEC_MATH201_01', { day: 'THU', timeSlotId: 'SLOT_1600' }, ctxFor([...data.lessons, extra])))).toEqual([
      'SECTION_COMPLETE',
    ]);
  });

  it('picks a free allowed teacher when the section has none and asks for review', () => {
    // AI310 allows T1, T4. T1 is busy MON 08:30 → T4.
    const plan = planSectionDrop('SEC_AI310_01', { day: 'MON', timeSlotId: 'SLOT_0830' }, ctxFor());
    expect(plan.status === 'ok' && plan.draft.teacherId).toBe('T4');
    expect(plan.status === 'ok' && plan.needsReview).toBe(true);
  });

  it('reports when no room is large enough and free', () => {
    // HIS120 (38) needs B-301 (40) or Hall-1 (60). Occupy both.
    const lessons: Lesson[] = [
      ...data.lessons,
      { id: 'a', sectionId: 'SEC_CS101_02', teacherId: 'T2', roomId: 'R301', day: 'FRI', timeSlotId: 'SLOT_0830' },
      { id: 'b', sectionId: 'SEC_PHY150_01', teacherId: 'T6', roomId: 'HALL1', day: 'FRI', timeSlotId: 'SLOT_0830' },
    ];
    expect(codes(planSectionDrop('SEC_HIS120_01', { day: 'FRI', timeSlotId: 'SLOT_0830' }, ctxFor(lessons)))).toEqual(['NO_ROOM']);
  });
});

describe('planLessonMove', () => {
  it('is a no-op on the same slot', () => {
    expect(planLessonMove(lesson('L1'), { day: 'MON', timeSlotId: 'SLOT_0830' }, ctxFor()).status).toBe('same');
  });

  it('rejects moving into a slot where the room is taken and suggests a free one', () => {
    // L4 (MATH201, R201) → THU 11:30 where L9 already uses R201.
    const plan = planLessonMove(lesson('L4'), { day: 'THU', timeSlotId: 'SLOT_1130' }, ctxFor());
    expect(plan.status).toBe('invalid');
    if (plan.status !== 'invalid') return;
    const roomIssue = plan.issues.find((i) => i.code === 'ROOM_BUSY');
    expect(roomIssue?.message).toMatch(/Свободна/);
  });

  it('allows a valid move', () => {
    expect(planLessonMove(lesson('L1'), { day: 'FRI', timeSlotId: 'SLOT_0830' }, ctxFor()).status).toBe('ok');
  });
});

describe('validateDraft', () => {
  it('flags a room that is too small', () => {
    const issues = validateDraft({ ...lesson('L3'), roomId: 'R101' }, ctxFor(), 'L3');
    expect(issues.map((i) => i.code)).toContain('ROOM_CAPACITY');
  });

  it('warns (but does not block) on room type mismatch', () => {
    const issues = validateDraft(lesson('L1'), ctxFor(), 'L1');
    expect(issues).toEqual([expect.objectContaining({ code: 'ROOM_TYPE_MISMATCH', severity: 'warning' })]);
  });
});

describe('pickRoom', () => {
  it('prefers the smallest free room of the preferred type', () => {
    const section = catalog.sectionsById.get('SEC_ENG110_01')!; // 20 students, LECTURE
    expect(pickRoom(section, { day: 'MON', timeSlotId: 'SLOT_1600' }, ctxFor())?.id).toBe('R101');
  });

  it('falls back to another type when the preferred one does not fit', () => {
    const section = catalog.sectionsById.get('SEC_CS101_01')!; // 24 students, LAB has 18
    expect(pickRoom(section, { day: 'FRI', timeSlotId: 'SLOT_1600' }, ctxFor())?.id).toBe('R102');
  });
});
