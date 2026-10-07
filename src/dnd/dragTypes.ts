import type { DropPlan, ValidationContext } from '../domain/validation';
import { planLessonMove, planSectionDrop } from '../domain/validation';
import type { Lesson, SlotRef } from '../domain/types';

/** What is being dragged. Stored in dnd-kit `data.current`. */
export type DragItem = { type: 'section'; sectionId: string } | { type: 'lesson'; lessonId: string };

/** Where it can be dropped. Stored in dnd-kit droppable `data.current`. */
export type DropTarget = { type: 'cell'; slot: SlotRef } | { type: 'unassign' };

export const dragId = (item: DragItem) =>
  item.type === 'section' ? `section:${item.sectionId}` : `lesson:${item.lessonId}`;

export const cellDropId = (slot: SlotRef) => `cell:${slot.day}:${slot.timeSlotId}`;
export const UNASSIGN_DROP_ID = 'unassign';

export function planDrop(
  item: DragItem,
  slot: SlotRef,
  ctx: ValidationContext,
  lessonsById: Map<string, Lesson>,
): DropPlan {
  if (item.type === 'section') return planSectionDrop(item.sectionId, slot, ctx);
  const lesson = lessonsById.get(item.lessonId);
  return lesson ? planLessonMove(lesson, slot, ctx) : { status: 'same' };
}
