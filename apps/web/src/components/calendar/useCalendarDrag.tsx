import { type DragEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { type DayEntry, parseLocalDate, toDateStr } from "./types";

type Gesture = {
  entry: DayEntry;
  pointer: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  element: HTMLElement;
};
export function useCalendarDrag(
  onMove: ((entry: DayEntry, date: Date) => void) | undefined,
  disabled: boolean,
) {
  const { t } = useTranslation();
  const current = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const previewElement = useRef<HTMLDivElement | null>(null);
  const hintElement = useRef<HTMLParagraphElement | null>(null);
  const previewFrame = useRef<number | null>(null);
  const dropTarget = useRef<HTMLElement | null>(null);
  const dragRoot = useRef<HTMLElement | null>(null);
  const [previewStart, setPreviewStart] = useState<{ name: string; x: number; y: number } | null>(
    null,
  );

  const clearVisuals = useCallback(() => {
    if (previewFrame.current !== null) window.cancelAnimationFrame(previewFrame.current);
    previewFrame.current = null;
    dropTarget.current?.removeAttribute("data-calendar-drop-target");
    dropTarget.current = null;
    dragRoot.current?.removeAttribute("data-calendar-dragging");
    dragRoot.current = null;
  }, []);
  const finish = useCallback(() => {
    const previous = current.current;
    current.current = null;
    clearVisuals();
    setPreviewStart(null);
    if (previous?.element.hasPointerCapture?.(previous.pointer))
      previous.element.releasePointerCapture(previous.pointer);
    return previous;
  }, [clearVisuals]);
  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && current.current) {
        event.preventDefault();
        suppressUntil.current = Date.now() + 400;
        finish();
      }
    };
    const blur = () => {
      if (current.current) finish();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", blur);
      current.current = null;
      clearVisuals();
    };
  }, [finish, clearVisuals]);
  useEffect(() => {
    if (disabled && current.current) finish();
  }, [disabled, finish]);
  const targetAt = (x: number, y: number, entry: DayEntry) => {
    const day = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-calendar-date]");
    return day?.dataset.calendarDate?.slice(0, 7) === toDateStr(entry.date).slice(0, 7)
      ? day
      : null;
  };
  const update = (event: PointerEvent<HTMLElement>) => {
    const value = current.current;
    if (!value || value.pointer !== event.pointerId) return;
    event.preventDefault();
    current.current = {
      ...value,
      x: event.clientX,
      y: event.clientY,
      active:
        value.active || Math.hypot(event.clientX - value.startX, event.clientY - value.startY) >= 5,
    };
    if (previewFrame.current !== null) return;
    // One hit test per frame. Changing days updates only their outlines, never
    // the calendar tree or its subscription logos and currency formatting.
    previewFrame.current = window.requestAnimationFrame(() => {
      previewFrame.current = null;
      const latest = current.current;
      if (!latest) return;
      const target = latest.active ? targetAt(latest.x, latest.y, latest.entry) : null;
      if (target !== dropTarget.current) {
        dropTarget.current?.removeAttribute("data-calendar-drop-target");
        target?.setAttribute("data-calendar-drop-target", "true");
        dropTarget.current = target;
      }
      if (previewElement.current)
        previewElement.current.style.transform = `translate3d(${latest.x + 12}px, ${latest.y + 12}px, 0)`;
      const hint = t(
        latest.active
          ? target
            ? "calendar_drop_hint"
            : "calendar_drag_same_month"
          : "calendar_drag_hint",
      );
      if (hintElement.current && hintElement.current.textContent !== hint)
        hintElement.current.textContent = hint;
    });
  };
  return {
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
        event.currentTarget.setPointerCapture?.(event.pointerId);
        current.current = {
          entry,
          pointer: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          active: false,
          element: event.currentTarget,
        };
        dragRoot.current = event.currentTarget.closest<HTMLElement>("[data-calendar-drag-root]");
        dragRoot.current?.setAttribute("data-calendar-dragging", "true");
        setPreviewStart({ name: entry.sub.name, x: event.clientX, y: event.clientY });
      },
      onPointerMove: update,
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const value = current.current;
        if (!value || value.pointer !== event.pointerId) return;
        if (value.active) {
          event.preventDefault();
          event.stopPropagation();
          suppressUntil.current = Date.now() + 400;
        }
        // A quick release must use the final pointer position even when the
        // queued visual frame has not run yet.
        const target = targetAt(event.clientX, event.clientY, value.entry)?.dataset.calendarDate;
        finish();
        const date = target && parseLocalDate(target);
        if (value.active && date && !disabled && target !== toDateStr(value.entry.date))
          onMove?.(value.entry, date);
      },
      onPointerCancel: () => {
        if (current.current) {
          suppressUntil.current = Date.now() + 400;
          finish();
        }
      },
      onLostPointerCapture: () => {
        if (current.current) finish();
      },
    }),
    preview: previewStart
      ? createPortal(
          <div
            ref={previewElement}
            role="status"
            className="pointer-events-none fixed z-[9999] max-w-64 rounded-xl border border-primary bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(${previewStart.x + 12}px, ${previewStart.y + 12}px, 0)`,
              willChange: "transform",
            }}
          >
            <p className="font-medium">{previewStart.name}</p>
            <p ref={hintElement} className="text-xs text-muted-foreground">
              {t("calendar_drag_hint")}
            </p>
          </div>,
          document.body,
        )
      : null,
  };
}
