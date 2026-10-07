import { Store } from '@tanstack/react-store';
import type { Lesson, LessonDraft } from '../domain/types';

/**
 * Lessons are the only mutable domain data. Every change goes through `commit`,
 * which gives us undo/redo and persistence for free.
 */
export interface ScheduleState {
  datasetKey: string | null;
  lessons: Lesson[];
  past: Lesson[][];
  future: Lesson[][];
  /** Last created/changed lesson — briefly highlighted in the grid. */
  lastChangedId: string | null;
}

const HISTORY_LIMIT = 100;
const STORAGE_KEY = 'schedule-dnd:lessons';

export const scheduleStore = new Store<ScheduleState>({
  datasetKey: null,
  lessons: [],
  past: [],
  future: [],
  lastChangedId: null,
});

const newId = () => `L-${Math.random().toString(36).slice(2, 9)}`;

function commit(next: Lesson[], lastChangedId: string | null = null) {
  scheduleStore.setState((s) => ({
    ...s,
    lessons: next,
    past: [...s.past, s.lessons].slice(-HISTORY_LIMIT),
    future: [],
    lastChangedId,
  }));
}

function loadPersisted(datasetKey: string): Lesson[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { datasetKey: string; lessons: Lesson[] };
    return parsed.datasetKey === datasetKey && Array.isArray(parsed.lessons) ? parsed.lessons : null;
  } catch {
    return null;
  }
}

scheduleStore.subscribe((s) => {
  if (!s.datasetKey) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ datasetKey: s.datasetKey, lessons: s.lessons }));
  } catch {
    // Storage unavailable (private mode / quota) — state simply isn't persisted.
  }
});

export const scheduleActions = {
  /** Initialise from loaded data; restores the user's work if it was made on the same dataset. */
  hydrate(datasetKey: string, initial: Lesson[]) {
    if (scheduleStore.state.datasetKey === datasetKey) return;
    scheduleStore.setState(() => ({
      datasetKey,
      lessons: loadPersisted(datasetKey) ?? initial,
      past: [],
      future: [],
      lastChangedId: null,
    }));
  },

  reset(initial: Lesson[]) {
    commit(initial);
  },

  add(draft: LessonDraft): Lesson {
    const lesson = { ...draft, id: newId() };
    commit([...scheduleStore.state.lessons, lesson], lesson.id);
    return lesson;
  },

  update(id: string, patch: Partial<LessonDraft>) {
    commit(
      scheduleStore.state.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      id,
    );
  },

  remove(id: string) {
    commit(scheduleStore.state.lessons.filter((l) => l.id !== id));
  },

  undo() {
    scheduleStore.setState((s) => {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, lessons: prev, past: s.past.slice(0, -1), future: [s.lessons, ...s.future], lastChangedId: null };
    });
  },

  redo() {
    scheduleStore.setState((s) => {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { ...s, lessons: next, past: [...s.past, s.lessons], future: rest, lastChangedId: null };
    });
  },
};
