import { fireEvent, render, screen } from "@testing-library/react";

import type { Currency } from "@/types";

import { BackfillPaymentsEditor } from "./BackfillPaymentsEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "tr" } }),
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      id={id}
      aria-label={label}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
describe("BackfillPaymentsEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  const props = {
    start: "2026-01-01",
    cycle: "Monthly",
    frequency: 1,
    price: 69.9,
    currency: { id: "try", code: "TRY", symbol: "₺" } as Currency,
  };
  it("lets the user choose a past-payment range independently of the automatic tracking start", () => {
    const onChange = vi.fn();
    render(
      <BackfillPaymentsEditor
        {...props}
        start="2026-10-01"
        anchorDate="2026-11-01"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "backfill_title" }));
    fireEvent.change(screen.getByLabelText("backfill_start_date"), {
      target: { value: "2026-01-01" },
    });
    expect(screen.getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getByLabelText("backfill_confirm"));
    expect(onChange.mock.lastCall?.[0].startDate).toBe("2026-01-01");
    expect(onChange.mock.lastCall?.[0].input.payments).toHaveLength(10);
  });
  it("requires review, permits different amounts and excluded rows, and resets confirmation after changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BackfillPaymentsEditor {...props} onChange={onChange} />);
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, valid: true, input: null });
    fireEvent.click(screen.getByRole("switch", { name: "backfill_title" }));
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(onChange.mock.lastCall?.[0].valid).toBe(false);
    fireEvent.change(screen.getByLabelText("amount · 01.01.2026"), { target: { value: "49.9" } });
    fireEvent.click(screen.getByLabelText("01.02.2026"));
    fireEvent.click(screen.getByLabelText("backfill_confirm"));
    const selection = onChange.mock.lastCall?.[0];
    expect(selection.valid).toBe(true);
    expect(selection.input.payments).toHaveLength(9);
    expect(selection.input.payments[0]).toMatchObject({ due_date: "2026-01-01", amount: 49.9 });
    expect(
      selection.input.payments.some((row: { due_date: string }) => row.due_date === "2026-02-01"),
    ).toBe(false);
    expect(selection.input.payments.at(-1)).toMatchObject({ due_date: "2026-10-01", amount: 69.9 });
    fireEvent.change(screen.getByLabelText("amount · 01.01.2026"), { target: { value: "59.9" } });
    expect(screen.getByLabelText("backfill_confirm")).not.toBeChecked();
    expect(onChange.mock.lastCall?.[0].valid).toBe(false);
    fireEvent.click(screen.getByLabelText("backfill_confirm"));
    rerender(<BackfillPaymentsEditor {...props} price={79.9} onChange={onChange} />);
    expect(screen.getByLabelText("backfill_confirm")).not.toBeChecked();
    expect(onChange.mock.lastCall?.[0].valid).toBe(false);
  });
  it("rejects empty amounts and does not generate future payments", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BackfillPaymentsEditor {...props} start="2026-10-01" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "backfill_title" }));
    fireEvent.change(screen.getByLabelText("amount · 01.10.2026"), { target: { value: "" } });
    expect(screen.getByLabelText("backfill_confirm")).toBeDisabled();
    expect(onChange.mock.lastCall?.[0].input).toBeNull();
    rerender(<BackfillPaymentsEditor {...props} start="2026-11-01" onChange={onChange} />);
    expect(screen.getByRole("alert")).toHaveTextContent("backfill_empty");
    expect(onChange.mock.lastCall?.[0].valid).toBe(false);
    fireEvent.click(screen.getByRole("switch", { name: "backfill_title" }));
    expect(onChange.mock.lastCall?.[0]).toEqual({ enabled: false, valid: true, input: null });
  });
});
