import { useDraggable } from '@dnd-kit/core';
import type { KeyboardEvent } from 'react';
import { courseOf, teacherName, type Catalog } from '../domain/catalog';
import type { SectionProgress } from '../domain/progress';
import type { Lesson, Section } from '../domain/types';
import { dragId, type DragItem } from '../dnd/dragTypes';
import { useCatalog } from '../hooks/catalogContext';
import { uiActions } from '../store/uiStore';
import { DesktopOutlined, TeamOutlined } from '@ant-design/icons';
import { Progress, Tag, Tooltip } from 'antd';

const STATUS_COLOR: Record<SectionProgress['status'], string> = { none: 'default', partial: 'warning', complete: 'success' };

const DAY_SHORT: Record<string, string> = { MON: 'Пн', TUE: 'Вт', WED: 'Ср', THU: 'Чт', FRI: 'Пт' };

interface ViewProps {
  section: Section;
  progress: SectionProgress;
  lessons?: Lesson[];
  selected?: boolean;
  catalog: Catalog;
}

/** Pure presentation — reused by the list and the drag overlay. */
export function SectionCardView({ section, progress, lessons = [], selected, catalog }: ViewProps) {
  const course = courseOf(catalog, section.id);
  const pct = Math.min(100, (progress.placed / progress.required) * 100);
  return (
    <div className={`section-card section-card--${progress.status}${selected ? ' is-selected' : ''}`}>
      <div className="section-card__top">
        <span className="section-card__code">{section.code}</span>
        <Tag color={STATUS_COLOR[progress.status]} className="section-card__count">
          {progress.placed} / {progress.required}
        </Tag>
      </div>
      <div className="section-card__name" title={course?.name}>
        {course?.name}
      </div>
      <div className="section-card__meta">
        <span title="Студентов">
          <TeamOutlined /> {section.studentsCount}
        </span>
        {section.teacherId ? (
          <span>{teacherName(catalog, section.teacherId)}</span>
        ) : (
          <Tooltip title={`Допустимы: ${section.allowedTeacherIds.map((t) => teacherName(catalog, t)).join(', ')}`}>
            <span className="warn-text">преподаватель не назначен</span>
          </Tooltip>
        )}
        {section.preferredRoomType === 'COMPUTER_LAB' && (
          <Tooltip title="Нужен компьютерный класс">
            <DesktopOutlined />
          </Tooltip>
        )}
      </div>
      <Progress
        percent={pct}
        showInfo={false}
        size={{ height: 4 }}
        strokeColor={progress.status === 'complete' ? 'var(--ok)' : 'var(--warn)'}
        className="section-card__progress"
      />
      {lessons.length > 0 && (
        <div className="section-card__slots">
          {lessons.map((l) => (
            <Tag key={l.id} variant="outlined" className="section-card__slot">
              {DAY_SHORT[l.day]} {catalog.timeSlotsById.get(l.timeSlotId)?.start}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props extends Omit<ViewProps, 'catalog'> {}

export function SectionCard(props: Props) {
  const catalog = useCatalog();
  const { section, progress } = props;
  const complete = progress.status === 'complete';
  const item: DragItem = { type: 'section', sectionId: section.id };
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: dragId(item),
    data: item,
    disabled: complete,
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !complete) {
      e.preventDefault();
      uiActions.toggleSection(section.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => !complete && uiActions.toggleSection(section.id)}
      className={`section-card-wrap${isDragging ? ' is-dragging' : ''}${complete ? ' is-complete' : ''}`}
      aria-pressed={props.selected}
      aria-label={`${section.code}: ${progress.placed} из ${progress.required}. ${
        complete ? 'Распределена полностью' : 'Перетащите на слот, или Enter — выбрать слот кликом'
      }`}
      title={complete ? 'Все занятия распределены' : 'Перетащите в расписание или кликните, чтобы выбрать слот'}
    >
      <SectionCardView {...props} catalog={catalog} />
    </div>
  );
}
