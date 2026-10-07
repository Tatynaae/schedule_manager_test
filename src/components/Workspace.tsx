import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useSelector } from '@tanstack/react-store';
import { useCallback, useMemo, useState } from 'react';
import { buildCatalog, sectionCode, slotLabel, roomName } from '../domain/catalog';
import type { DropPlan } from '../domain/validation';
import type { ScheduleData, SlotRef } from '../domain/types';
import { slotKey } from '../domain/types';
import { dragId, planDrop, type DragItem, type DropTarget } from '../dnd/dragTypes';
import { CatalogContext, useCatalog } from '../hooks/catalogContext';
import { useClickOutsideSelection } from '../hooks/useClickOutsideSelection';
import { useHotkeys } from '../hooks/useHotkeys';
import { useScheduleModel } from '../hooks/useScheduleModel';
import { scheduleActions } from '../store/scheduleStore';
import { uiActions, uiStore } from '../store/uiStore';
import { notify } from './notify';
import { AppHeader } from './AppHeader';
import { DragPreview } from './DragPreview';
import { LessonEditor } from './LessonEditor';
import { ScheduleGrid } from './ScheduleGrid';
import { SectionsPanel } from './SectionsPanel';

export function Workspace({ data }: { data: ScheduleData }) {
  const catalog = useMemo(() => buildCatalog(data), [data]);
  return (
    <CatalogContext.Provider value={catalog}>
      <Board initialLessons={data.lessons} />
    </CatalogContext.Provider>
  );
}

// Pointer: the cell under the cursor. Keyboard: the cell overlapping the dragged node.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export type PlansBySlot = Map<string, DropPlan>;

function Board({ initialLessons }: { initialLessons: ScheduleData['lessons'] }) {
  const catalog = useCatalog();
  const model = useScheduleModel();
  const selectedSectionId = useSelector(uiStore, (s) => s.selectedSectionId);
  const [active, setActive] = useState<DragItem | null>(null);
  const [overSlot, setOverSlot] = useState<SlotRef | null>(null);
  useHotkeys();
  useClickOutsideSelection();

  const sensors = useSensors(
    // Small distance so a click on a card still opens it / selects it.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  );

  // What we are currently "placing": a dragged item, or a section picked for click-to-place.
  const placing: DragItem | null =
    active ?? (selectedSectionId ? { type: 'section', sectionId: selectedSectionId } : null);

  const placingKey = placing ? dragId(placing) : null;

  // Evaluate every cell once per drag (30 cells — cheap), so the grid can colour all of them.
  const plans: PlansBySlot | null = useMemo(() => {
    if (!placing) return null;
    const map: PlansBySlot = new Map();
    for (const day of catalog.weekDays) {
      for (const t of catalog.timeSlots) {
        const slot = { day: day.id, timeSlotId: t.id };
        map.set(slotKey(slot), planDrop(placing, slot, model.ctx, model.lessonsById));
      }
    }
    return map;
    // `placing` is a fresh object every render; its identity is captured by `placingKey`.
  }, [placingKey, model, catalog]);

  const apply = useCallback(
    (item: DragItem, slot: SlotRef, plan: DropPlan) => {
      if (plan.status === 'same') return;
      if (plan.status === 'invalid') {
        notify({ tone: 'error', title: `Нельзя поставить в ${slotLabel(catalog, slot)}`, lines: plan.issues.map((i) => i.message) });
        return;
      }
      const code = sectionCode(catalog, plan.draft.sectionId);
      const where = `${slotLabel(catalog, slot)}, ${roomName(catalog, plan.draft.roomId)}`;
      const warnings = plan.warnings.map((w) => w.message);
      if (item.type === 'section') {
        const lesson = scheduleActions.add(plan.draft);
        const section = catalog.sectionsById.get(item.sectionId)!;
        const placed = (model.ctx.placedBySection.get(section.id) ?? 0) + 1;
        if (placed >= section.requiredLessonsPerWeek && uiStore.state.selectedSectionId === section.id) {
          uiActions.set({ selectedSectionId: null });
        }
        if (plan.needsReview) uiActions.set({ editingLessonId: lesson.id });
        notify({
          tone: 'success',
          title: `${code} → ${where}`,
          lines: [`Распределено ${placed} / ${section.requiredLessonsPerWeek}`, ...warnings],
          action: { label: 'Отменить', run: scheduleActions.undo },
        });
      } else {
        scheduleActions.update(item.lessonId, slot);
        notify({ tone: 'success', title: `${code} перенесено → ${where}`, lines: warnings, action: { label: 'Отменить', run: scheduleActions.undo } });
      }
    },
    [catalog, model],
  );

  const placeSelected = useCallback(
    (slot: SlotRef) => {
      if (!selectedSectionId) return;
      const item: DragItem = { type: 'section', sectionId: selectedSectionId };
      apply(item, slot, planDrop(item, slot, model.ctx, model.lessonsById));
    },
    [apply, selectedSectionId, model],
  );

  const onDragStart = (e: DragStartEvent) => {
    setActive(e.active.data.current as DragItem);
    uiActions.set({ selectedSectionId: null });
  };

  const onDragOver = (e: DragOverEvent) => {
    const target = e.over?.data.current as DropTarget | undefined;
    setOverSlot(target?.type === 'cell' ? target.slot : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const item = e.active.data.current as DragItem;
    const target = e.over?.data.current as DropTarget | undefined;
    setActive(null);
    setOverSlot(null);
    if (!target) return;
    if (target.type === 'unassign') {
      if (item.type !== 'lesson') return;
      const lesson = model.lessonsById.get(item.lessonId);
      if (!lesson) return;
      scheduleActions.remove(lesson.id);
      notify({
        tone: 'info',
        title: `${sectionCode(catalog, lesson.sectionId)}: занятие снято с расписания`,
        lines: [slotLabel(catalog, lesson)],
        action: { label: 'Отменить', run: scheduleActions.undo },
      });
      return;
    }
    apply(item, target.slot, plans?.get(slotKey(target.slot)) ?? planDrop(item, target.slot, model.ctx, model.lessonsById));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragCancel={() => {
        setActive(null);
        setOverSlot(null);
      }}
      accessibility={{ screenReaderInstructions: { draggable: 'Пробел — взять. Стрелки — перемещать. Пробел/Enter — отпустить, Esc — отмена.' } }}
    >
      <div className="app">
        <AppHeader initialLessons={initialLessons} />
        <div className="layout">
          <SectionsPanel model={model} draggingLesson={active?.type === 'lesson'} />
          <ScheduleGrid
            model={model}
            plans={plans} mode={active ? 'drag' : selectedSectionId ? 'select' : null}
            overSlot={overSlot}
            onPlace={placeSelected}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{active && <DragPreview item={active} model={model} />}</DragOverlay>
      <LessonEditor />
    </DndContext>
  );
}
