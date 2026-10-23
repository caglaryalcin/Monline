import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import type { DayEntry } from "@/components/calendar/types";
import type { Subscription } from "@/types";

import { CalendarMonthCard } from "./CalendarMonthCard";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span>logo</span> }));
const entry: DayEntry = {
  sub: { id: "subscription", name: "Sample", price: 10 } as Subscription,
  date: new Date(2026, 3, 10),
};
let hit: Element | null = null;
const originalHitTest = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
beforeEach(() => {
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerId = options.pointerId || 1;
        this.isPrimary = options.isPrimary !== false;
      }
    },
  );
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => hit),
  });
});
afterEach(() => {
  hit = null;
  vi.unstubAllGlobals();
  if (originalHitTest) Object.defineProperty(document, "elementFromPoint", originalHitTest);
  else Reflect.deleteProperty(document, "elementFromPoint");
});
function mount(
  options: { entry?: DayEntry; moving?: boolean; entriesByDate?: Record<string, DayEntry[]> } = {},
) {
  const onMovePayment = vi.fn(),
    onSelectDay = vi.fn(),
    onMoveToMonth = vi.fn();
  const view = render(
    <CalendarMonthCard
      month={4}
      year={2026}
      now={new Date(2026, 3, 1)}
      daysInMonth={30}
      isCurrentMonth
      loading={false}
      selectedDay={null}
      allCells={[
        { day: 10, type: "current" },
        { day: 11, type: "current" },
        { day: 1, type: "current" },
        { day: 1, type: "next" },
      ]}
      entriesByDay={{ 10: [options.entry || entry] }}
      entriesByDate={options.entriesByDate}
      currencyById={new Map()}
      paymentTracking
      paymentRecords={[]}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onGoToday={vi.fn()}
      onSelectMonth={vi.fn()}
      onSelectDay={onSelectDay}
      onMovePayment={onMovePayment}
      onMoveToMonth={onMoveToMonth}
      movingPayment={options.moving}
    />,
  );
  const source = view.container.querySelector<HTMLElement>("[data-calendar-payment]")!;
  const root = view.container.querySelector<HTMLElement>("[data-calendar-drag-root]")!;
  root.setPointerCapture = vi.fn();
  root.hasPointerCapture = vi.fn(() => true);
  root.releasePointerCapture = vi.fn();
  const target = (date: string) => view.container.querySelector(`[data-calendar-date="${date}"]`)!;
  const press = () =>
    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
  const release = (date: string | null) => {
    hit = date ? target(date) : null;
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 150, clientY: 20 });
    fireEvent.pointerUp(source, { pointerId: 1, button: 0, clientX: 150, clientY: 20 });
  };
  return {
    ...view,
    root,
    source,
    target,
    press,
    release,
    onMovePayment,
    onSelectDay,
    onMoveToMonth,
  };
}
it("forwards the right-clicked payment from the month card to the month-move dialog", async () => {
  const { source, onMoveToMonth, onMovePayment } = mount();
  fireEvent.contextMenu(source);
  fireEvent.click(await screen.findByRole("menuitem", { name: "calendar_move_to_month" }));
  expect(onMoveToMonth).toHaveBeenCalledExactlyOnceWith(entry);
  expect(onMovePayment).not.toHaveBeenCalled();
});
it("disables the month move while saving", async () => {
  const { source, onMoveToMonth } = mount({ moving: true });
  fireEvent.contextMenu(source);
  const action = await screen.findByRole("menuitem", { name: "calendar_move_to_month" });
  expect(action).toHaveAttribute("data-disabled");
  fireEvent.click(action);
  expect(onMoveToMonth).not.toHaveBeenCalled();
});
it.each(["2026-04-11", "2026-04-01"])(
  "starts from mouse press and moves the payment to %s",
  (date) => {
    const { source, root, press, release, onMovePayment, onSelectDay } = mount();
    press();
    expect(screen.getByRole("status")).toHaveTextContent("Sample");
    expect(root.setPointerCapture).not.toHaveBeenCalled();
    release(date);
    expect(root.setPointerCapture).toHaveBeenCalledWith(1);
    expect(onMovePayment).toHaveBeenCalledExactlyOnceWith(entry, new Date(date + "T00:00:00"));
    fireEvent.click(source);
    expect(onSelectDay).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
);
it("highlights and moves to a day in another month", () => {
  const { source, target, press, onMovePayment } = mount();
  press();
  hit = target("2026-05-01");
  fireEvent.pointerMove(source, { pointerId: 1, clientX: 150, clientY: 20 });
  expect(target("2026-05-01").className).toContain("bg-primary/15");
  fireEvent.pointerUp(source, { pointerId: 1, button: 0, clientX: 150, clientY: 20 });
  expect(onMovePayment).toHaveBeenCalledExactlyOnceWith(entry, new Date(2026, 4, 1));
  expect(target("2026-05-01").className).not.toContain("bg-primary/15");
});
it("shows the moved payment in the adjacent date cell while the visible month and other payment stay put", () => {
  const adjacent = {
    ...entry,
    sub: { ...entry.sub, id: "moved", name: "Moved payment" },
    date: new Date(2026, 4, 1),
  };
  const { target, container } = mount({ entriesByDate: { "2026-05-01": [adjacent] } });
  expect(target("2026-05-01")).toHaveTextContent("Moved payment");
  expect(target("2026-04-01")).not.toHaveTextContent("Moved payment");
  expect(target("2026-04-10")).toHaveTextContent("Sample");
  expect(container.querySelectorAll("[data-calendar-payment]")).toHaveLength(2);
});
it("does not move a simple click, a drop on the original day or a release outside the calendar", () => {
  const { source, target, press, release, onMovePayment } = mount();
  press();
  hit = target("2026-04-10");
  fireEvent.pointerUp(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
  press();
  release("2026-04-10");
  press();
  release(null);
  expect(onMovePayment).not.toHaveBeenCalled();
});
it.each(["escape", "cancel", "blur"])("cancels a pressed drag on %s", (action) => {
  const { source, press, release, onMovePayment } = mount();
  press();
  if (action === "escape") fireEvent.keyDown(window, { key: "Escape" });
  else if (action === "cancel") fireEvent.pointerCancel(source, { pointerId: 1 });
  else fireEvent.blur(window);
  release("2026-04-11");
  expect(onMovePayment).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("does not start a gesture while saving or from the secondary mouse button", () => {
  const view = mount({ moving: true });
  view.press();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  view.unmount();
  const { source, release, onMovePayment } = mount();
  fireEvent.pointerDown(source, { pointerId: 1, button: 2, clientX: 10, clientY: 10 });
  release("2026-04-11");
  expect(onMovePayment).not.toHaveBeenCalled();
});

it.each(["prev", "next"] as const)(
  "keeps dragging across a year boundary through the %s arrow after the original cell unmounts",
  (direction) => {
    vi.useFakeTimers();
    const original: DayEntry = {
      ...entry,
      date: new Date(2026, direction === "next" ? 11 : 0, 10),
    };
    const onMove = vi.fn();
    function Calendar() {
      const [visible, setVisible] = useState(
        new Date(original.date.getFullYear(), original.date.getMonth(), 1),
      );
      return (
        <CalendarMonthCard
          month={visible.getMonth() + 1}
          year={visible.getFullYear()}
          now={new Date(2026, 0, 1)}
          daysInMonth={31}
          isCurrentMonth
          loading={false}
          selectedDay={null}
          allCells={[{ day: 10, type: "current" }]}
          entriesByDay={
            visible.getTime() ===
            new Date(original.date.getFullYear(), original.date.getMonth(), 1).getTime()
              ? { 10: [original] }
              : {}
          }
          currencyById={new Map()}
          paymentTracking
          paymentRecords={[]}
          onPrev={() => setVisible((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
          onNext={() => setVisible((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
          onGoToday={vi.fn()}
          onSelectMonth={vi.fn()}
          onSelectDay={vi.fn()}
          onMovePayment={onMove}
        />
      );
    }
    try {
      const { container, unmount } = render(<Calendar />);
      const source = container.querySelector<HTMLElement>("[data-calendar-payment]")!;
      fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
      hit = container.querySelector(`[data-calendar-navigate="${direction}"]`);
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, clientY: 20 });
      act(() => vi.advanceTimersByTime(700));
      expect(source.isConnected).toBe(false);
      expect(onMove).not.toHaveBeenCalled();
      // Keep hovering to pass two months without releasing the original pointer.
      act(() => vi.advanceTimersByTime(700));
      const date = direction === "next" ? "2027-02-10" : "2025-11-10";
      hit = container.querySelector(`[data-calendar-date="${date}"]`);
      expect(hit).not.toBeNull();
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 180, clientY: 90 });
      act(() => vi.advanceTimersByTime(1400));
      expect(container.querySelector(`[data-calendar-date="${date}"]`)).toBe(hit);
      fireEvent.pointerUp(window, { pointerId: 1, button: 0, clientX: 180, clientY: 90 });
      expect(onMove).toHaveBeenCalledExactlyOnceWith(original, new Date(date + "T00:00:00"));
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  },
);

it("cancels pending month navigation on Escape and ignores a second pointer", () => {
  vi.useFakeTimers();
  try {
    const { source, container, press, onMovePayment, unmount } = mount();
    press();
    hit = container.querySelector('[data-calendar-navigate="next"]');
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 150, clientY: 20 });
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 150, clientY: 20 });
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1400));
    expect(onMovePayment).not.toHaveBeenCalled();
    unmount();
  } finally {
    vi.useRealTimers();
  }
});
