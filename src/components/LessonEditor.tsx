import { useForm } from '@tanstack/react-form';
import { useSelector } from '@tanstack/react-store';
import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Modal, Select, Space, Tag, Typography } from 'antd';
import { courseOf, sectionCode, slotLabel } from '../domain/catalog';
import type { Lesson, WeekDay } from '../domain/types';
import { hasErrors, rankRooms, teacherIssues, validateDraft } from '../domain/validation';
import { useCatalog } from '../hooks/catalogContext';
import { useScheduleModel, type ScheduleModel } from '../hooks/useScheduleModel';
import { scheduleActions } from '../store/scheduleStore';
import { uiActions, uiStore } from '../store/uiStore';
import { notify } from './notify';

export function LessonEditor() {
  const id = useSelector(uiStore, (s) => s.editingLessonId);
  const model = useScheduleModel();
  const lesson = id ? model.lessonsById.get(id) : undefined;
  if (!lesson) return null;
  // `key` resets the form when another lesson is opened.
  return <EditorDialog key={lesson.id} lesson={lesson} model={model} />;
}

interface FormValues {
  teacherId: string;
  roomId: string;
  day: WeekDay;
  timeSlotId: string;
}

const close = () => uiActions.set({ editingLessonId: null });

function EditorDialog({ lesson, model }: { lesson: Lesson; model: ScheduleModel }) {
  const catalog = useCatalog();
  const section = catalog.sectionsById.get(lesson.sectionId)!;

  const validate = (v: FormValues) => validateDraft({ ...v, sectionId: section.id }, model.ctx, lesson.id);

  const form = useForm({
    defaultValues: {
      teacherId: lesson.teacherId,
      roomId: lesson.roomId,
      day: lesson.day,
      timeSlotId: lesson.timeSlotId,
    } as FormValues,
    validators: {
      onChange: ({ value }) => (hasErrors(validate(value)) ? 'Есть конфликты' : undefined),
    },
    onSubmit: ({ value }) => {
      if (hasErrors(validate(value))) return;
      scheduleActions.update(lesson.id, value);
      notify({
        tone: 'success',
        title: `${section.code}: занятие обновлено`,
        lines: [slotLabel(catalog, value)],
        action: { label: 'Отменить', run: scheduleActions.undo },
      });
      close();
    },
  });

  const dayOptions = catalog.weekDays.map((d) => ({ value: d.id, label: d.label }));
  const timeOptions = catalog.timeSlots.map((t) => ({ value: t.id, label: `${t.start}–${t.end}` }));

  const remove = () => {
    scheduleActions.remove(lesson.id);
    notify({
      tone: 'info',
      title: `${sectionCode(catalog, lesson.sectionId)}: занятие снято с расписания`,
      action: { label: 'Отменить', run: scheduleActions.undo },
    });
    close();
  };

  const submit = () => form.handleSubmit();

  return (
    <form.Subscribe selector={(s) => s.values}>
      {(values) => {
        const issues = validate(values);
        const blocked = hasErrors(issues);
        const rooms = rankRooms(section, values, model.ctx, lesson.id);
        const best = rooms.find((r) => r.available);

        const teacherOptions = section.allowedTeacherIds.map((tid) => {
          const problems = teacherIssues(tid, values, model.ctx, lesson.id);
          const name = catalog.teachersById.get(tid)?.name ?? tid;
          return {
            value: tid,
            name,
            label: (
              <OptionLabel
                text={name}
                tags={problems.map((p) => (p.code === 'TEACHER_BLOCKED' ? 'недоступен' : 'занят'))}
              />
            ),
          };
        });
        const roomOptions = rooms.map(({ room, issues: problems }) => ({
          value: room.id,
          name: room.name,
          label: (
            <OptionLabel
              text={`${room.name} · ${room.capacity} мест · ${room.type === 'COMPUTER_LAB' ? 'комп. класс' : 'лекционная'}`}
              tags={problems.map((p) => (p.code === 'ROOM_BUSY' ? 'занята' : 'мала'))}
            />
          ),
        }));

        return (
          <Modal
            open
            onCancel={close}
            width={540}
            title={
              <div>
                {section.code}
                <Typography.Text type="secondary" className="modal-subtitle">
                  {courseOf(catalog, section.id)?.name} · {section.studentsCount} студентов
                </Typography.Text>
              </div>
            }
            footer={
              <div className="modal-footer">
                <Button danger onClick={remove}>
                  Снять с расписания
                </Button>
                <Space>
                  <Button onClick={close}>Отмена</Button>
                  <Button type="primary" onClick={submit} disabled={blocked}>
                    Сохранить
                  </Button>
                </Space>
              </div>
            }
          >
            <Form layout="vertical" onFinish={submit}>
              {section.teacherId === null && (
                <Alert type="warning" showIcon title="У секции нет закреплённого преподавателя — проверьте выбор." className="editor-note" />
              )}
              <div className="form-grid">
                <form.Field name="day">
                  {(field) => (
                    <Form.Item label="День">
                      <Select autoFocus value={field.state.value} options={dayOptions} onChange={(v) => field.handleChange(v)} />
                    </Form.Item>
                  )}
                </form.Field>
                <form.Field name="timeSlotId">
                  {(field) => (
                    <Form.Item label="Время">
                      <Select value={field.state.value} options={timeOptions} onChange={(v) => field.handleChange(v)} />
                    </Form.Item>
                  )}
                </form.Field>
              </div>
              <form.Field name="teacherId">
                {(field) => (
                  <Form.Item label="Преподаватель" validateStatus={issues.some((i) => i.code.startsWith('TEACHER')) ? 'error' : undefined}>
                    <Select value={field.state.value} options={teacherOptions} optionLabelProp="label" onChange={(v) => field.handleChange(v)} />
                  </Form.Item>
                )}
              </form.Field>
              <form.Field name="roomId">
                {(field) => (
                  <Form.Item label="Аудитория" validateStatus={issues.some((i) => i.code.startsWith('ROOM_') && i.severity === 'error') ? 'error' : undefined}>
                    <Space.Compact block>
                      <Select
                        value={field.state.value}
                        options={roomOptions}
                        showSearch={{ optionFilterProp: 'name' }}
                        onChange={(v) => field.handleChange(v)}
                      />
                      <Button
                        icon={<ThunderboltOutlined />}
                        disabled={!best || best.room.id === field.state.value}
                        onClick={() => best && field.handleChange(best.room.id)}
                        title="Свободная аудитория подходящего типа с минимальным запасом мест"
                      >
                        Подобрать
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                )}
              </form.Field>

              {issues.length > 0 ? (
                <Space orientation="vertical" className="editor-issues">
                  {issues.map((i) => (
                    <Alert key={i.message} type={i.severity === 'error' ? 'error' : 'warning'} showIcon title={i.message} />
                  ))}
                </Space>
              ) : (
                <Alert type="success" showIcon title="Конфликтов нет" />
              )}
            </Form>
          </Modal>
        );
      }}
    </form.Subscribe>
  );
}

function OptionLabel({ text, tags }: { text: string; tags: string[] }) {
  return (
    <span className="option-label">
      <span>{text}</span>
      {tags.map((t) => (
        <Tag key={t} color="error" variant="filled">
          {t}
        </Tag>
      ))}
    </span>
  );
}
