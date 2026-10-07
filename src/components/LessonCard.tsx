import { ExclamationCircleFilled } from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import type { KeyboardEvent } from 'react';
import { courseOf, roomName, teacherName, type Catalog } from '../domain/catalog';
import type { Issue, LessonDraft } from '../domain/types';
import { dragId, type DragItem } from '../dnd/dragTypes';
import { useCatalog } from '../hooks/catalogContext';
import { uiActions } from '../store/uiStore';

interface ViewProps {
  lesson: LessonDraft;
  catalog: Catalog;
  errors?: Issue[];
  variant?: 'normal' | 'ghost' | 'overlay';
  dimmed?: boolean;
  highlighted?: boolean;
}

export function LessonCardView({ lesson, catalog, errors = [], variant = 'normal', dimmed, highlighted }: ViewProps) {
  const section = catalog.sectionsById.get(lesson.sectionId);
  const room = catalog.roomsById.get(lesson.roomId);
  const cls = [
    'lesson',
    `lesson--${variant}`,
    errors.length ? 'has-error' : '',
    dimmed ? 'is-dimmed' : '',
    highlighted ? 'is-highlighted' : '',
  ].join(' ');
  return (
    <div className={cls} title={errors.map((e) => e.message).join('\n') || undefined}>
      <div className="lesson__top">
        <span className="lesson__code">{section?.code}</span>
        {errors.length > 0 && <ExclamationCircleFilled className="lesson__alert" aria-label="Конфликт" />}
      </div>
      <div className="lesson__name">{courseOf(catalog, lesson.sectionId)?.name}</div>
      <div className="lesson__meta">
        <span>{teacherName(catalog, lesson.teacherId)}</span>
        <span className={room && section && room.capacity < section.studentsCount ? 'warn-text' : ''}>
          {roomName(catalog, lesson.roomId)}
          {room && section && <span className="muted"> {section.studentsCount}/{room.capacity}</span>}
        </span>
      </div>
    </div>
  );
}

interface Props extends Omit<ViewProps, 'catalog' | 'lesson' | 'variant'> {
  lesson: LessonDraft & { id: string };
}

export function LessonCard({ lesson, ...rest }: Props) {
  const catalog = useCatalog();
  const item: DragItem = { type: 'lesson', lessonId: lesson.id };
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: dragId(item), data: item });

  const open = () => uiActions.set({ editingLessonId: lesson.id });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      open();
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
      onClick={open}
      className={`lesson-wrap${isDragging ? ' is-dragging' : ''}`}
      aria-label={`Занятие ${catalog.sectionsById.get(lesson.sectionId)?.code}, ${teacherName(catalog, lesson.teacherId)}, ${roomName(catalog, lesson.roomId)}. Enter — изменить, пробел — перенести`}
    >
      <LessonCardView lesson={lesson} catalog={catalog} {...rest} />
    </div>
  );
}
