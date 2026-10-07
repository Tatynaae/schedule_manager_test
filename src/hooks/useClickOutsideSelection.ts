import { useEffect } from 'react';
import { uiActions, uiStore } from '../store/uiStore';

/** Places where a click keeps the current section selected (click-to-place mode). */
const KEEP_SELECTION = '.cell, .section-card-wrap, .ant-modal-root, .ant-select-dropdown';

/** Clicking anywhere outside the grid slots / section cards cancels the section selection. */
export function useClickOutsideSelection() {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!uiStore.state.selectedSectionId) return;
      if (e.target instanceof Element && e.target.closest(KEEP_SELECTION)) return;
      uiActions.set({ selectedSectionId: null });
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
}
