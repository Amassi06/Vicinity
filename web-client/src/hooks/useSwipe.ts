import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

const SWIPE_THRESHOLD_PX = 60;

export interface SwipeHandlers {
  onPointerDown: (ev: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (ev: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (ev: ReactPointerEvent<HTMLElement>) => void;
}

export function useSwipe(opts: { onSwipeLeft: () => void; onSwipeRight: () => void }): SwipeHandlers {
  const startX = useRef<number | null>(null);

  return {
    onPointerDown: (ev) => {
      startX.current = ev.clientX;
    },
    onPointerMove: () => {
      /* no visual drag-follow needed */
    },
    onPointerUp: (ev) => {
      if (startX.current === null) return;
      const deltaX = ev.clientX - startX.current;
      startX.current = null;
      if (deltaX <= -SWIPE_THRESHOLD_PX) opts.onSwipeLeft();
      else if (deltaX >= SWIPE_THRESHOLD_PX) opts.onSwipeRight();
    },
  };
}
