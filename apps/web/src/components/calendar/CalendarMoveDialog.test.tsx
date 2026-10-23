import { fireEvent, render, screen } from "@testing-library/react";

import { CalendarMoveDialog } from "./CalendarMoveDialog";
import type { DayEntry } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key.endsWith("_summary") ? [key, ...Object.values(values || {})].join(" | ") : key,
    i18n: { language: "tr" },
  }),
}));
const entry = { sub: { id: "sub", name: "One payment" }, date: new Date(2026, 0, 31) } as DayEntry;
it.each(["28/02/2026", "31/01/2027"])(
  "moves only to the selected different month/year: %s",
  (value) => {
    const onMove = vi.fn();
    render(<CalendarMoveDialog entry={entry} moving={false} onClose={vi.fn()} onMove={onMove} />);
    const submit = screen.getByRole("button", { name: "calendar_move_payment" });
    expect(submit).toBeDisabled();
    for (const invalid of ["1", "31/02/2026", "15/02/"]) {
      fireEvent.change(screen.getByLabelText("calendar_move_date"), { target: { value: invalid } });
      expect(submit).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText("calendar_move_date"), {
      target: { value: "25/01/2026" },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("calendar_move_date"), { target: { value } });
    fireEvent.click(submit);
    const [day, month, year] = value.split("/").map(Number);
    expect(onMove).toHaveBeenCalledExactlyOnceWith(new Date(year, month - 1, day));
    expect(entry.date).toEqual(new Date(2026, 0, 31));
  },
);
it("cancels without moving and prevents duplicate submissions while saving", () => {
  const onClose = vi.fn(),
    onMove = vi.fn();
  const { rerender } = render(
    <CalendarMoveDialog entry={entry} moving={false} onClose={onClose} onMove={onMove} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText("calendar_move_date"), {
    target: { value: "15/02/2026" },
  });
  rerender(<CalendarMoveDialog entry={entry} moving onClose={onClose} onMove={onMove} />);
  expect(screen.getByLabelText("calendar_move_date")).toBeDisabled();
  fireEvent.submit(screen.getByRole("button", { name: "saving" }).closest("form")!);
  expect(onMove).not.toHaveBeenCalled();
});
