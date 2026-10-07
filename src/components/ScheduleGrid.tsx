import { CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { useSelector } from '@tanstack/react-store';
import { blockedKey, roomName, slotLabel, teacherName } from '../domain/catalog';
import type { DropPlan } from '../domain/validation';
import { lessonsIn } from '../domain/lessonIndex';
import type { SlotRef } from '../domain/types';
import { slotKey } from '../domain/types';
import { lessonErrors } from '../domain/validation';
import { useCatalog } from '../hooks/catalogContext';
import type { ScheduleModel } from '../hooks/useScheduleModel';
import { scheduleStore } from '../store/scheduleStore';
import { uiStore } from '../store/uiStore';
import { GridCell, type CellHint } from './GridCell';
import type { PlansBySlot } from './Workspace';

interface Props {
  model: ScheduleModel;
  plans: PlansBySlot | null;
  mode: 'drag' | 'select' | null;
  overSlot: SlotRef | null;
  onPlace: (slot: SlotRef) => void;
}

export function ScheduleGrid({ model, plans, mode, overSlot, onPlace }: Props) {
  const catalog = useCatalog();
  const teacherId = useSelector(uiStore, (s) => s.teacherId);
  const roomId = useSelector(uiStore, (s) => s.roomId);
  const selectedSectionId = useSelector(uiStore, (s) => s.selectedSectionId);
  const lastChangedId = useSelector(scheduleStore, (s) => s.lastChangedId);
  const selected = selectedSectionId ? catalog.sectionsById.get(selectedSectionId) : undefined;

  // Hints shown when idle and a teacher/room filter is active: where that resource is free.
  const hintFor = (slot: SlotRef): CellHint | undefined => {
    if (mode) return undefined;
    const here = lessonsIn(model.ctx.bySlot, slot);
    if (teacherId) {
      const blocked = catalog.blocked.get(blockedKey(teacherId, slot));
      if (blocked) return { tone: 'blocked', text: `Преподаватель: ${blocked.reason.toLowerCase()}` };
      if (here.some((l) => l.teacherId === teacherId)) return undefined;
    }
    if (roomId) {
      if (here.some((l) => l.roomId === roomId)) return undefined;
      return { tone: 'free', text: `${catalog.roomsById.get(roomId)?.name} свободна` };
    }
    if (teacherId) return { tone: 'free', text: 'Преподаватель свободен' };
    return undefined;
  };

  return (
    <section className="grid-wrap" aria-label="Недельное расписание">
      {/* Always rendered (fixed height) so the grid doesn't jump when a drag starts. */}
      {mode === 'drag' ? (
        <DragStatus slot={overSlot} plan={overSlot ? plans?.get(slotKey(overSlot)) : undefined} />
      ) : mode === 'select' && selected ? (
        <div className="drag-status drag-status--select" role="status">
          Выберите слот для <b>{selected.code}</b> — зелёные ячейки доступны, наведите на штриховку, чтобы увидеть причину. <Typography.Text keyboard>Esc</Typography.Text> — отмена
        </div>
      ) : (
        <div className="drag-status">
          Перетащите секцию на ячейку или кликните по ней, чтобы выбрать слот. Занятие можно перенести или вернуть в список слева.
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${catalog.weekDays.length}, minmax(150px, 1fr))` }}>
        <div className="grid__corner" />
        {catalog.weekDays.map((d) => (
          <div key={d.id} className="grid__day">
            {d.label}
          </div>
        ))}
        {catalog.timeSlots.map((t) => (
          <Row key={t.id}>
            <div className="grid__time">
              <b>{t.start}</b>
              <span>{t.end}</span>
            </div>
            {catalog.weekDays.map((d) => {
              const slot: SlotRef = { day: d.id, timeSlotId: t.id };
              const lessons = lessonsIn(model.ctx.bySlot, slot).map((l) => ({
                lesson: l,
                errors: lessonErrors(l, model.ctx),
                dimmed: (!!teacherId && l.teacherId !== teacherId) || (!!roomId && l.roomId !== roomId),
                highlighted: l.id === lastChangedId || l.sectionId === selectedSectionId,
              }));
              return (
                <GridCell
                  key={d.id}
                  slot={slot}
                  lessons={lessons}
                  plan={plans?.get(slotKey(slot))}
                  mode={mode}
                  hint={hintFor(slot)}
                  onPlace={onPlace}
                />
              );
            })}
          </Row>
        ))}
      </div>
    </section>
  );
}

// Rows are only a logical grouping — cells are direct children of the CSS grid.
const Row = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/** One-line summary of what will happen on drop — always visible, never covered by the overlay. */
function DragStatus({ slot, plan }: { slot: SlotRef | null; plan: DropPlan | undefined }) {
  const catalog = useCatalog();
  if (!slot || !plan) {
    return (
      <div className="drag-status" role="status">
        Зелёные ячейки — можно поставить, штриховка — конфликт. Наведите, чтобы увидеть причину.
      </div>
    );
  }
  const where = slotLabel(catalog, slot);
  if (plan.status === 'same') return <div className="drag-status" role="status">{where} — текущее место</div>;
  if (plan.status === 'invalid') {
    return (
      <div className="drag-status drag-status--error" role="status" title={plan.issues.map((i) => i.message).join('\n')}>
        <StopOutlined /> <b>{where}: нельзя.</b> {plan.issues.map((i) => i.message).join('; ')}
      </div>
    );
  }
  return (
    <div className="drag-status drag-status--ok" role="status">
      <CheckCircleOutlined /> <b>{where}</b> · {teacherName(catalog, plan.draft.teacherId)} · {roomName(catalog, plan.draft.roomId)}
      {plan.needsReview && ' · преподаватель подобран автоматически, проверьте'}
      {plan.warnings.map((w) => ` · ⚠ ${w.message}`)}
    </div>
  );
}
