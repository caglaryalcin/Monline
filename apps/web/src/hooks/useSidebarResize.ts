import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { LS_KEYS } from "@/lib/constants";

const MIN_WIDTH = 210;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 260;
const clamp = (width: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));

function initialWidth() {
  try {
    const stored = Number(localStorage.getItem(LS_KEYS.SIDEBAR_WIDTH));
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useSidebarResize() {
  const [width, setWidth] = useState(initialWidth);
  const [resizing, setResizing] = useState(false);
  const start = useRef<{
    pointerX: number;
    width: number;
    pointerId: number;
    element: HTMLDivElement;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.SIDEBAR_WIDTH, String(width));
    } catch {
      /* Resizing works without browser storage. */
    }
  }, [width]);

  useEffect(() => {
    if (resizing) document.documentElement.dataset.sidebarResizing = "true";
    return () => {
      delete document.documentElement.dataset.sidebarResizing;
    };
  }, [resizing]);

  function stop() {
    const current = start.current;
    start.current = null;
    if (current?.element.hasPointerCapture(current.pointerId))
      current.element.releasePointerCapture(current.pointerId);
    setResizing(false);
  }

  return {
    width,
    resizing,
    cancelResize: stop,
    handleProps: {
      role: "separator" as const,
      tabIndex: 0,
      "aria-orientation": "vertical" as const,
      "aria-valuemin": MIN_WIDTH,
      "aria-valuemax": MAX_WIDTH,
      "aria-valuenow": width,
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !window.matchMedia("(min-width: 1024px)").matches) return;
        event.preventDefault();
        start.current = {
          pointerX: event.clientX,
          width,
          pointerId: event.pointerId,
          element: event.currentTarget,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizing(true);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!start.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setWidth(clamp(start.current.width + event.clientX - start.current.pointerX));
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: stop,
      onDoubleClick: () => setWidth(DEFAULT_WIDTH),
      onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 50 : 10;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setWidth((current) => clamp(current + (event.key === "ArrowRight" ? step : -step)));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          setWidth(event.key === "Home" ? MIN_WIDTH : MAX_WIDTH);
        } else if (event.key === "Escape" && start.current) {
          event.preventDefault();
          setWidth(start.current.width);
          stop();
        }
      },
    },
  };
}
