import { sectionProgress } from '../domain/progress';
import type { DragItem } from '../dnd/dragTypes';
import { useCatalog } from '../hooks/catalogContext';
import type { ScheduleModel } from '../hooks/useScheduleModel';
import { LessonCardView } from './LessonCard';
import { SectionCardView } from './SectionCard';

/** What follows the cursor during a drag. */
export function DragPreview({ item, model }: { item: DragItem; model: ScheduleModel }) {
  const catalog = useCatalog();
  if (item.type === 'lesson') {
    const lesson = model.lessonsById.get(item.lessonId);
    return lesson ? <LessonCardView lesson={lesson} catalog={catalog} variant="overlay" /> : null;
  }
  const section = catalog.sectionsById.get(item.sectionId);
  if (!section) return null;
  return (
    <div className="section-overlay">
      <SectionCardView
        section={section}
        progress={sectionProgress(section, model.ctx.placedBySection.get(section.id) ?? 0)}
        catalog={catalog}
      />
    </div>
  );
}
