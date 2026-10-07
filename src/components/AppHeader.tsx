import { RedoOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import { useSelector } from '@tanstack/react-store';
import { Button, Popconfirm, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import type { Lesson } from '../domain/types';
import { useCatalog } from '../hooks/catalogContext';
import { useScheduleModel } from '../hooks/useScheduleModel';
import { scheduleActions, scheduleStore } from '../store/scheduleStore';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

export function AppHeader({ initialLessons }: { initialLessons: Lesson[] }) {
  const catalog = useCatalog();
  const { ctx } = useScheduleModel();
  const canUndo = useSelector(scheduleStore, (s) => s.past.length > 0);
  const canRedo = useSelector(scheduleStore, (s) => s.future.length > 0);

  const stats = useMemo(() => {
    let required = 0;
    let placed = 0;
    let done = 0;
    for (const s of catalog.sections) {
      const p = Math.min(ctx.placedBySection.get(s.id) ?? 0, s.requiredLessonsPerWeek);
      required += s.requiredLessonsPerWeek;
      placed += p;
      if (p >= s.requiredLessonsPerWeek) done++;
    }
    return { required, placed, done, remaining: required - placed };
  }, [catalog, ctx]);

  const pct = stats.required ? Math.round((stats.placed / stats.required) * 100) : 100;

  return (
    <header className="header">
      <Typography.Title level={4} className="header__title">
        Распределение секций
      </Typography.Title>
      <div className="header__stats" aria-live="polite">
        <Progress percent={pct} size={[140, 8]} showInfo={false} strokeColor="var(--ok)" aria-label="Распределено занятий" />
        <span>
          <b>{stats.placed}</b> / {stats.required} занятий
        </span>
        {stats.remaining ? <Tag color="warning">осталось {stats.remaining}</Tag> : <Tag color="success">всё распределено</Tag>}
        <Typography.Text type="secondary">
          секций готово {stats.done} / {catalog.sections.length}
        </Typography.Text>
      </div>
      <Space size={6}>
        <Tooltip title={`Отменить (${mod}Z)`}>
          <Button icon={<UndoOutlined />} onClick={scheduleActions.undo} disabled={!canUndo}>
            Отменить
          </Button>
        </Tooltip>
        <Tooltip title={`Повторить (${mod}Shift+Z)`}>
          <Button icon={<RedoOutlined />} onClick={scheduleActions.redo} disabled={!canRedo}>
            Повторить
          </Button>
        </Tooltip>
        <Popconfirm
          title="Вернуть исходное расписание?"
          description="Действие можно отменить."
          okText="Сбросить"
          cancelText="Нет"
          onConfirm={() => scheduleActions.reset(initialLessons)}
        >
          <Button type="text" icon={<ReloadOutlined />}>
            Сбросить
          </Button>
        </Popconfirm>
      </Space>
    </header>
  );
}
