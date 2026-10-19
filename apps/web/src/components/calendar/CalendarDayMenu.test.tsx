import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CalendarDayMenu } from "./CalendarDayMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }),
}));

function setup() {
  const onSelectDay = vi.fn();
  const onAddHistorical = vi.fn();
  render(
    <CalendarDayMenu
      now={new Date(2026, 9, 17, 12)}
      onSelectDate={onSelectDay}
      onAddHistorical={onAddHistorical}
    >
      <button data-calendar-date="2026-09-12">
        <span>past day</span>
      </button>
      <button data-calendar-date="2026-10-17">today</button>
      <button data-calendar-date="2026-10-18">future day</button>
      <button data-calendar-date="2025-10-16">old day</button>
      <button disabled>other month</button>
    </CalendarDayMenu>,
  );
  return { onSelectDay, onAddHistorical };
}

describe("CalendarDayMenu", () => {
  it("opens at a right-click and forwards the clicked day to the payment form", async () => {
    const { onAddHistorical, onSelectDay } = setup();
    fireEvent.contextMenu(screen.getByText("past day"), { clientX: 220, clientY: 180 });
    expect(await screen.findByText("12 Eylül 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "historical_add" }));
    expect(onAddHistorical).toHaveBeenCalledWith(new Date(2026, 8, 12, 12));
    expect(onSelectDay).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
  it("supports the keyboard context-menu shortcut and viewing a day", async () => {
    const { onSelectDay } = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "today" }), {
      key: "F10",
      shiftKey: true,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "calendar_day_payments" }));
    expect(onSelectDay).toHaveBeenCalledWith(new Date(2026, 9, 17, 12));
  });
  it.each(["future day", "old day"])(
    "prevents historical payments on %s while allowing its payments to be viewed",
    async (day) => {
      const { onAddHistorical } = setup();
      fireEvent.contextMenu(screen.getByRole("button", { name: day }));
      const add = await screen.findByRole("menuitem", { name: "historical_add" });
      expect(add).toHaveAttribute("data-disabled");
      expect(screen.getByText("calendar_history_range_hint")).toBeInTheDocument();
      fireEvent.click(add);
      expect(onAddHistorical).not.toHaveBeenCalled();
    },
  );
  it("leaves non-current-month cells without an app menu", () => {
    setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "other month" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
