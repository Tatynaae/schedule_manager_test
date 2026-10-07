import { Store } from '@tanstack/react-store';
import type { ProgressStatus } from '../domain/progress';

export type StatusFilter = 'all' | 'todo' | ProgressStatus;

export interface UiState {
  search: string;
  status: StatusFilter;
  teacherId: string | null;
  roomId: string | null;
  /** Click-to-place mode (keyboard/mouse alternative to dragging a section). */
  selectedSectionId: string | null;
  editingLessonId: string | null;
}

export const uiStore = new Store<UiState>({
  search: '',
  status: 'todo',
  teacherId: null,
  roomId: null,
  selectedSectionId: null,
  editingLessonId: null,
});

export const uiActions = {
  set(patch: Partial<UiState>) {
    uiStore.setState((s) => ({ ...s, ...patch }));
  },
  resetFilters() {
    uiStore.setState((s) => ({ ...s, search: '', teacherId: null, roomId: null }));
  },
  toggleSection(id: string) {
    uiStore.setState((s) => ({ ...s, selectedSectionId: s.selectedSectionId === id ? null : id }));
  },
};
