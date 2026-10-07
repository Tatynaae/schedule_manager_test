import { useEffect } from 'react';
import { scheduleActions } from '../store/scheduleStore';
import { uiActions, uiStore } from '../store/uiStore';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape' && uiStore.state.selectedSectionId && !uiStore.state.editingLessonId) {
        uiActions.set({ selectedSectionId: null });
        return;
      }
      if (!mod || isTyping(e.target) || uiStore.state.editingLessonId) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        scheduleActions.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        scheduleActions.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
