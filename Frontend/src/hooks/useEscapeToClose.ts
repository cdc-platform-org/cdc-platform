import { useEffect } from 'react';

// Closes a modal/lightbox on Escape — standard accessibility expectation
// that none of this codebase's modals had. Pass `active: false` (or omit
// the condition) to skip attaching the listener when the modal isn't open,
// so closed-but-still-mounted modals don't eat every Escape keypress on
// the page.
export function useEscapeToClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onClose]);
}
