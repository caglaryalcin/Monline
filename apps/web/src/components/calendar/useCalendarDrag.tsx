import { type DragEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { type DayEntry, parseLocalDate, toDateStr } from "./types";

type Direction = "prev" | "next";
type Gesture = {
  entry: DayEntry;
  pointer: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  target: string | null;
  direction: Direction | null;
  root: HTMLElement;
};

export function useCalendarDrag(
  onMove: ((entry: DayEntry, date: Date) => void) | undefined,
  disabled: boolean,
  onPrev: () => void,
  onNext: () => void,
) {
  const { t } = useTranslation();
  const current = useRef<Gesture | null>(null);
  const callbacks = useRef({ onMove, disabled, onPrev, onNext });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressUntil = useRef(0);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  useEffect(() => {
    callbacks.current = { onMove, disabled, onPrev, onNext };
  });

  const clearNavigation = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const finish = useCallback(() => {
    const previous = current.current;
    current.current = null;
    clearNavigation();
    setGesture(null);
    if (previous?.root.hasPointerCapture?.(previous.pointer))
      previous.root.releasePointerCapture(previous.pointer);
  }, [clearNavigation]);

  useEffect(() => {
    function hitTest(value: Gesture, x: number, y: number) {
      const element = document.elementFromPoint?.(x, y);
      if (!element || !value.root.contains(element)) return { target: null, direction: null };
      const date = element.closest<HTMLElement>("[data-calendar-date]")?.dataset.calendarDate;
      const direction = element.closest<HTMLElement>("[data-calendar-navigate]")?.dataset
        .calendarNavigate;
      return {
        target: date && parseLocalDate(date) ? date : null,
        direction: direction === "prev" || direction === "next" ? direction : null,
      } as Pick<Gesture, "target" | "direction">;
    }
    function scheduleNavigation(direction: Direction) {
      timer.current = setTimeout(() => {
        timer.current = null;
        const value = current.current;
        if (
          !value?.active ||
          callbacks.current.disabled ||
          hitTest(value, value.x, value.y).direction !== direction
        )
          return;
        (direction === "prev" ? callbacks.current.onPrev : callbacks.current.onNext)();
        scheduleNavigation(direction);
      }, 700);
    }
    const move = (event: globalThis.PointerEvent) => {
      const value = current.current;
      if (!value || value.pointer !== event.pointerId) return;
      event.preventDefault();
      const next = {
        ...value,
        x: event.clientX,
        y: event.clientY,
        active:
          value.active ||
          Math.hypot(event.clientX - value.startX, event.clientY - value.startY) >= 5,
        ...hitTest(value, event.clientX, event.clientY),
      };
      // Capture on the stable card only once this is a drag. A simple click
      // must still reach the payment's day button.
      if (next.active && !value.active) value.root.setPointerCapture?.(event.pointerId);
      if (next.direction !== value.direction) clearNavigation();
      if (next.active && next.direction && timer.current === null)
        scheduleNavigation(next.direction);
      current.current = next;
      setGesture(next);
    };
    const up = (event: globalThis.PointerEvent) => {
      const value = current.current;
      if (!value || value.pointer !== event.pointerId) return;
      if (value.active) {
        event.preventDefault();
        suppressUntil.current = Date.now() + 400;
      }
      const { target } = hitTest(value, event.clientX, event.clientY);
      finish();
      const date = target && parseLocalDate(target);
      if (
        value.active &&
        date &&
        !callbacks.current.disabled &&
        target !== toDateStr(value.entry.date)
      )
        callbacks.current.onMove?.(value.entry, date);
    };
    const cancel = () => {
      if (current.current) {
        suppressUntil.current = Date.now() + 400;
        finish();
      }
    };
    const cancelPointer = (event: globalThis.PointerEvent) => {
      if (event.pointerId === current.current?.pointer) cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && current.current) {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      clearNavigation();
      const value = current.current;
      current.current = null;
      if (value?.root.hasPointerCapture?.(value.pointer))
        value.root.releasePointerCapture(value.pointer);
    };
  }, [clearNavigation, finish]);
  useEffect(() => {
    if (disabled && current.current) finish();
  }, [disabled, finish]);

  return {
    dropDate: gesture?.active ? gesture.target : null,
    direction: gesture?.active ? gesture.direction : null,
    suppressClick: () => Date.now() < suppressUntil.current,
    paymentProps: (entry: DayEntry, allowed: boolean) => ({
      draggable: false,
      style: allowed ? { touchAction: "none", userSelect: "none" as const } : undefined,
      onDragStart: (event: DragEvent) => event.preventDefault(),
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (
          !allowed ||
          disabled ||
          !onMove ||
          current.current ||
          event.button !== 0 ||
          event.isPrimary === false
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const root = event.currentTarget.closest<HTMLElement>("[data-calendar-drag-root]")!;
        const value: Gesture = {
          entry,
          pointer: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          active: false,
          target: null,
          direction: null,
          root,
        };
        current.current = value;
        setGesture(value);
      },
    }),
    preview: gesture
      ? createPortal(
          <div
            role="status"
            className="pointer-events-none fixed z-[9999] max-w-64 rounded-xl border border-primary bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl"
            style={{ left: gesture.x + 12, top: gesture.y + 12 }}
          >
            <p className="font-medium">{gesture.entry.sub.name}</p>
            <p className="text-xs text-muted-foreground">
              {t(
                gesture.active
                  ? gesture.target
                    ? "calendar_drop_hint"
                    : "calendar_drag_outside"
                  : "calendar_drag_hint",
              )}
            </p>
          </div>,
          document.body,
        )
      : null,
  };
}
