import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { queryKeys } from "@/lib/queryKeys";
import { createQueryClientWrapper } from "@/test/query-client";
import type { PaymentRecord, Subscription } from "@/types";

import { historicalDateRange, HistoricalPaymentDialog } from "./HistoricalPaymentDialog";

const mocks = vi.hoisted(() => ({ createHistorical: vi.fn(), success: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "tr" } }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span /> }));
vi.mock("@/services/paymentRecords", () => ({
  paymentRecordsService: { createHistorical: mocks.createHistorical },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: mocks.success } }));

const subscription = {
  id: "sub-1",
  name: "Music",
  price: 25,
  currency: "eur",
  record_type: "expense",
  inactive: true,
} as Subscription;

function setup(records: PaymentRecord[] = []) {
  const { client, Wrapper } = createQueryClientWrapper();
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <HistoricalPaymentDialog
      subscriptions={[
        subscription,
        { ...subscription, id: "credit-1", name: "Income", record_type: "credit" },
      ]}
      currencies={[
        {
          id: "eur",
          code: "EUR",
          symbol: "€",
          rate: 1,
          is_main: true,
          name: "Euro",
          user: "user-1",
        },
      ]}
      records={records}
      userId="user-1"
      onClose={onClose}
      onSaved={onSaved}
    />,
    { wrapper: Wrapper },
  );
  return { onSaved, onClose, invalidate };
}

describe("HistoricalPaymentDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("cancels the unsaved payment when the backdrop is clicked", async () => {
    const { onClose, onSaved } = setup();
    fireEvent.change(screen.getByLabelText("amount (EUR)"), { target: { value: "70" } });
    const backdrop = document.querySelector('[data-state="open"].fixed.inset-0')!;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.createHistorical).not.toHaveBeenCalled();
  });

  it("offers inactive expenses and sets a rolling one-year window, clamping leap day", async () => {
    setup();
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Music · inactive" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Income" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByLabelText("historical_paid_date")).toHaveValue("17/10/2026");
    for (const label of ["historical_paid_date", "historical_due_date"]) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}:`) }));
      expect(screen.getByRole("combobox", { name: "Ayı seçin" })).toHaveTextContent("Ekim");
      expect(screen.getByRole("button", { name: "Temizle" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^18 Ekim 2026/ })).toBeDisabled();
      await userEvent.keyboard("{Escape}");
    }
    expect(historicalDateRange(new Date(2024, 1, 29))).toEqual({
      min: "2023-02-28",
      max: "2024-02-29",
    });
  });

  it("saves the selected payment and due dates, preserves zero and refreshes dependent data", async () => {
    const record = {
      id: "paid-1",
      subscription_id: subscription.id,
      due_date: "2026-06-05",
      amount: 0,
    } as PaymentRecord;
    mocks.createHistorical.mockResolvedValue(record);
    const { onSaved, invalidate } = setup();
    fireEvent.change(screen.getByLabelText("historical_paid_date"), {
      target: { value: "2026-06-10" },
    });
    expect(screen.getByLabelText("historical_due_date")).toHaveValue("10/06/2026");
    fireEvent.change(screen.getByLabelText("historical_due_date"), {
      target: { value: "2026-06-05" },
    });
    fireEvent.change(screen.getByLabelText("amount (EUR)"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("notes"), { target: { value: " receipt " } });
    fireEvent.click(screen.getByRole("button", { name: "historical_save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(record));
    expect(mocks.createHistorical).toHaveBeenCalledWith({
      subscription_id: subscription.id,
      due_date: "2026-06-05",
      paid_date: "2026-06-10",
      amount: 0,
      notes: "receipt",
      utc_offset_minutes: new Date().getTimezoneOffset(),
      paid_utc_offset_minutes: new Date("2026-06-10T00:00:00").getTimezoneOffset(),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.paymentRecords.all("user-1") });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.subscriptions.history("user-1", "sub-1"),
    });
  });

  it.each([
    ["historical_paid_date", "16/10/2025"],
    ["historical_paid_date", "18/10/2026"],
    ["historical_due_date", "16/10/2025"],
    ["historical_due_date", "18/10/2026"],
    ["historical_paid_date", "31/02/2026"],
  ])("rejects invalid or out-of-range manual dates in %s (%s)", (label, value) => {
    setup();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "historical_save" }));
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) => alert.textContent?.includes("historical_invalid_date")),
    ).toBe(true);
    expect(mocks.createHistorical).not.toHaveBeenCalled();
  });

  it("blocks an already paid day and reports a server-side duplicate without closing", async () => {
    mocks.createHistorical.mockRejectedValue({ response: { error: "historical_duplicate" } });
    const { onSaved } = setup([
      {
        id: "existing",
        subscription_id: subscription.id,
        due_date: "2026-10-17",
        paid_at: "2026-10-17T00:00:00Z",
      } as PaymentRecord,
    ]);
    expect(screen.getByRole("button", { name: "historical_save" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("historical_duplicate");
    fireEvent.change(screen.getByLabelText("historical_paid_date"), {
      target: { value: "2026-09-17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "historical_save" }));
    await waitFor(() => expect(mocks.createHistorical).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("historical_duplicate"),
    );
    expect(onSaved).not.toHaveBeenCalled();
  });
});
