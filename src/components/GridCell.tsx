import { PlusOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { Button } from 'antd';
import type { Issue, Lesson, SlotRef } from '../domain/types';
import type { DropPlan } from '../domain/validation';
import { cellDropId, type DropTarget } from '../dnd/dragTypes';
import { useCatalog } from '../hooks/catalogContext';
import { slotLabel } from '../domain/catalog';
import { LessonCard, LessonCardView } from './LessonCard';

export interface CellHint {
  tone: 'free' | 'blocked';
  text: string;
}

interface Props {
  slot: SlotRef;
  lessons: { lesson: Lesson; errors: Issue[]; dimmed: boolean; highlighted: boolean }[];
  plan: DropPlan | undefined;
  mode: 'drag' | 'select' | null;
  hint?: CellHint;
  onPlace: (slot: SlotRef) => void;
}

export function GridCell({ slot, lessons, plan, mode, hint, onPlace }: Props) {
  const catalog = useCatalog();
  const target: DropTarget = { type: 'cell', slot };
  const { setNodeRef, isOver } = useDroppable({ id: cellDropId(slot), data: target });

  const state = !plan ? '' : plan.status === 'ok' ? 'is-valid' : plan.status === 'invalid' ? 'is-invalid' : 'is-origin';
  const reasons = plan?.status === 'invalid' ? plan.issues : [];
  const showReasons = reasons.length > 0 && (isOver || mode === 'select');

  return (
    <div
      ref={setNodeRef}
      className={`cell ${state}${isOver ? ' is-over' : ''}${hint ? ` hint--${hint.tone}` : ''}`}
      data-slot={`${slot.day}:${slot.timeSlotId}`}
    >
      {/* Reasons go first: the drag overlay hangs below-right of the cursor. */}
      {showReasons && (
        <ul className={`cell__reasons${isOver ? ' is-visible' : ''}`} role={isOver ? 'alert' : undefined}>
          {reasons.map((r) => (
            <li key={r.message}>{r.message}</li>
          ))}
        </ul>
      )}

      {lessons.map(({ lesson, ...rest }) => (
        <LessonCard key={lesson.id} lesson={lesson} {...rest} />
      ))}

      {/* Where the item would land — rendered before the drop. */}
      {isOver && plan?.status === 'ok' && <LessonCardView lesson={plan.draft} catalog={catalog} variant="ghost" />}

      {mode === 'select' && plan?.status === 'ok' && (
        <Button
          className="cell__place"
          type="dashed"
          size="small"
          block
          icon={<PlusOutlined />}
          onClick={() => onPlace(slot)}
          aria-label={`Поставить в ${slotLabel(catalog, slot)}`}
        >
          сюда
        </Button>
      )}

      {hint && <div className="cell__hint">{hint.text}</div>}
    </div>
  );
}
