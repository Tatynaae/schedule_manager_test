import { useDroppable } from '@dnd-kit/core';
import { useSelector } from '@tanstack/react-store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import { sectionProgress, type ProgressStatus } from '../domain/progress';
import type { Lesson } from '../../types.ts';
import { UNASSIGN_DROP_ID, type DropTarget } from '../dnd/dragTypes';
import { useCatalog } from '../hooks/catalogContext';
import type { ScheduleModel } from '../hooks/useScheduleModel';
import { uiActions, uiStore, type StatusFilter } from '../store/uiStore';
import { SectionCard } from './SectionCard';
import { SearchOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Segmented, Select } from 'antd';

const STATUS_ORDER: Record<ProgressStatus, number> = { none: 0, partial: 1, complete: 2 };
const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'todo', label: 'Осталось' },
  { id: 'none', label: 'Не начаты' },
  { id: 'partial', label: 'Частично' },
  { id: 'complete', label: 'Готово' },
  { id: 'all', label: 'Все' },
];

const matchesStatus = (filter: StatusFilter, status: ProgressStatus) =>
  filter === 'all' || (filter === 'todo' ? status !== 'complete' : filter === status);

export function SectionsPanel({ model, draggingLesson }: { model: ScheduleModel; draggingLesson: boolean }) {
  const catalog = useCatalog();
  const { search, status, teacherId, roomId, selectedSectionId } = useSelector(uiStore, (s) => s, {
    compare: (a, b) =>
      a.search === b.search && a.status === b.status && a.teacherId === b.teacherId && a.roomId === b.roomId && a.selectedSectionId === b.selectedSectionId,
  });

  const target: DropTarget = { type: 'unassign' };
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGN_DROP_ID, data: target });

  const lessonsBySection = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of model.lessons) {
      const list = map.get(l.sectionId) ?? [];
      list.push(l);
      map.set(l.sectionId, list);
    }
    return map;
  }, [model.lessons]);

  const { rows, counts } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts: Record<StatusFilter, number> = { all: 0, todo: 0, none: 0, partial: 0, complete: 0 };
    const rows = [];
    for (const section of catalog.sections) {
      if (teacherId && section.teacherId !== teacherId && !(section.teacherId === null && section.allowedTeacherIds.includes(teacherId))) continue;
      if (q) {
        const course = catalog.coursesById.get(section.courseId);
        const haystack = `${section.code} ${course?.name ?? ''} ${course?.code ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      const progress = sectionProgress(section, model.ctx.placedBySection.get(section.id) ?? 0);
      counts.all++;
      counts[progress.status]++;
      if (progress.status !== 'complete') counts.todo++;
      if (matchesStatus(status, progress.status)) rows.push({ section, progress });
    }
    rows.sort(
      (a, b) => STATUS_ORDER[a.progress.status] - STATUS_ORDER[b.progress.status] || a.section.code.localeCompare(b.section.code),
    );
    return { rows, counts };
  }, [catalog, model.ctx, search, status, teacherId]);

  const teacherOptions = useMemo(() => catalog.teachers.map((t) => ({ value: t.id, label: t.name })), [catalog]);
  const roomOptions = useMemo(
    () => catalog.rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.capacity}` })),
    [catalog],
  );
  const hasFilters = Boolean(search || teacherId || roomId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 112,
    overscan: 6,
    getItemKey: (i) => rows[i].section.id,
  });

  return (
    <aside ref={setNodeRef} className={`panel${draggingLesson ? ' panel--unassign' : ''}${isOver ? ' is-over' : ''}`} aria-label="Секции">
      <div className="panel__filters">
        <Input
          allowClear
          prefix={<SearchOutlined className="muted" />}
          placeholder="Поиск: код или предмет"
          value={search}
          onChange={(e) => uiActions.set({ search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && search) {
              e.stopPropagation();
              uiActions.set({ search: '' });
            }
          }}
          aria-label="Поиск секций"
        />
        <div className="filter-row">
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            value={teacherId}
            onChange={(id) => uiActions.set({ teacherId: id ?? null })}
            placeholder="Все преподаватели"
            options={teacherOptions}
            aria-label="Фильтр по преподавателю"
            popupMatchSelectWidth={false}
          />
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            value={roomId}
            onChange={(id) => uiActions.set({ roomId: id ?? null })}
            placeholder="Все аудитории"
            options={roomOptions}
            aria-label="Фильтр по аудитории"
            popupMatchSelectWidth={false}
          />
        </div>
        <Segmented<StatusFilter>
          block
          size="small"
          aria-label="Статус распределения"
          value={status}
          onChange={(id) => uiActions.set({ status: id })}
          options={STATUS_TABS.map((tab) => ({
            value: tab.id,
            label: (
              <div className="status-option">
                <b>{counts[tab.id]}</b>
                <span>{tab.label}</span>
              </div>
            ),
          }))}
        />
        {hasFilters && (
          <div className="filter-summary" role="status">
            <span>
              Найдено секций: <b>{counts.all}</b>
            </span>
            <Button type="link" size="small" onClick={uiActions.resetFilters}>
              Сбросить фильтры
            </Button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="panel__list">
        {rows.length === 0 ? (
          <Empty
            className="empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={status === 'todo' && counts.all > 0 ? 'Все секции распределены' : 'Ничего не найдено'}
          >
            {hasFilters && (
              <Button size="small" onClick={uiActions.resetFilters}>
                Сбросить фильтры
              </Button>
            )}
          </Empty>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const { section, progress } = rows[v.index];
              return (
                <div
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className="panel__row"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <SectionCard
                    section={section}
                    progress={progress}
                    lessons={lessonsBySection.get(section.id)}
                    selected={selectedSectionId === section.id}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {draggingLesson && (
        <div className="unassign-hint" aria-hidden>
          <span>⤺</span>
          {isOver ? 'Отпустите — занятие вернётся в нераспределённые' : 'Перетащите сюда, чтобы снять занятие с расписания'}
        </div>
      )}
    </aside>
  );
}
