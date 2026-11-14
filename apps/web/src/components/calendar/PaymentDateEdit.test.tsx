import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MarkAsPaidModal } from "@/components/calendar/MarkAsPaidModal";
import { editedPaymentDate, paymentDateForRecord } from "@/lib/paymentDate";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import type { Currency, PaymentRecord, Subscription } from "@/types";

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
vi.mock("@/hooks/useLocalToday", () => ({ useLocalToday: () => "2026-11-14" }));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { logoUrl: () => null } }));
vi.mock("@/hooks/useLogoSearch", () => ({ useLogoSearch: () => ({ logoPreview: null, logoUrl: null, resolveLogoFile: async () => null }) }));
vi.mock("@/services/paymentRecords", () => ({ paymentRecordsService: { update: mocks.update, create: mocks.create, proofUrl: () => null } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const currency = { id: "try", code: "TRY", symbol: "₺", rate: 1, is_main: true } as Currency;
const sub = { id: "sub", user: "owner", name: "Streaming", price: 300, currency: "try", auto_renew: true, inactive: false,
  next_payment: "2026-12-05", start_date: "2026-01-05", frequency: 1, cycle: "monthly", expand: { currency, cycle: { id: "monthly", name: "Monthly" } },
} as Subscription;
const record = { id: "record", subscription_id: "sub", user: "owner", due_date: "2026-11-05", paid_at: "2026-11-05T10:00:00.000Z",
  auto_paid: true, amount: 125.75, notes: "original", proof: "receipt.pdf", currency: "try",
} as PaymentRecord;
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
function renderModal(payment = record, mode: "edit" | "confirm" = "edit") {
  mocks.update.mockImplementation(async (_id, values) => ({ ...payment, ...values }));
  const onSaved = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><MarkAsPaidModal sub={sub} date={new Date(2026, 10, 5)} userId="owner"
    existingRecord={payment} mode={mode} onClose={vi.fn()} onSaved={onSaved} t={(key) => key} /></QueryClientProvider>);
  return onSaved;
}
it("edits the paid day on the same record and moves its paid statistics without changing the billing day or receipt", async () => {
  const onSaved = renderModal();
  fireEvent.change(screen.getByRole("textbox", { name: "historical_paid_date" }), { target: { value: "31/10/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "save_changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const [id, body] = mocks.update.mock.calls[0];
  expect(id).toBe(record.id);
  expect(body).toMatchObject({ paid_at: new Date(2026, 9, 31).toISOString(), auto_paid: false, due_date: "2026-11-05", amount: 125.75, notes: "original" });
  expect(body).not.toHaveProperty("proof");
  expect(body).not.toHaveProperty("scheduled_date");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(sub.next_payment).toBe("2026-12-05");
  const totals = buildPaymentStatistics([sub], [currency], [{ ...record, ...body }], new Date(2026, 10, 14), 12, 12, 2026);
  expect(totals.paid[9]).toMatchObject({ total: 125.75, count: 1 });
  expect(totals.paid[10]).toMatchObject({ total: 0, count: 0 });
});
it("preserves the exact timestamp and automatic flag when the paid day is unchanged", async () => {
  const onSaved = renderModal();
  fireEvent.change(screen.getByLabelText("notes"), { target: { value: "updated note" } });
  fireEvent.click(screen.getByRole("button", { name: "save_changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledWith(record.id, expect.objectContaining({ paid_at: record.paid_at, auto_paid: true, notes: "updated note" }));
});
it("does not mark a pending record as paid when editing its details", async () => {
  const onSaved = renderModal({ ...record, paid_at: "", auto_paid: false });
  expect(screen.queryByRole("textbox", { name: "historical_paid_date" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "save_changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledWith(record.id, expect.objectContaining({ paid_at: "", auto_paid: false }));
});
it.each(["01/01/2027", "30/02/2026", ""])("rejects an invalid or future paid day: %s", (value) => {
  renderModal();
  fireEvent.change(screen.getByRole("textbox", { name: "historical_paid_date" }), { target: { value } });
  expect(screen.getByRole("button", { name: "save_changes" })).toBeDisabled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("uses the local day for a UTC payment near midnight in Turkey", () => {
  vi.stubEnv("TZ", "Europe/Istanbul");
  expect(paymentDateForRecord("2026-11-13T22:30:00.000Z")).toBe("2026-11-14");
  expect(editedPaymentDate("2026-10-31", record, new Date("2026-11-14T12:00:00Z"))).toEqual({ paid_at: "2026-10-30T21:00:00.000Z", auto_paid: false });
});
it("uses each selected day's DST offset rather than the current offset", () => {
  vi.stubEnv("TZ", "America/New_York");
  const now = new Date("2026-11-14T12:00:00Z");
  expect(editedPaymentDate("2026-07-10", record, now).paid_at).toBe("2026-07-10T04:00:00.000Z");
  expect(editedPaymentDate("2026-01-10", record, now).paid_at).toBe("2026-01-10T05:00:00.000Z");
});
it("rejects impossible dates and future confirmations even outside the form", () => {
  const now = new Date(2026, 10, 14, 12);
  expect(() => editedPaymentDate("2026-02-30", record, now)).toThrow("payment_date_invalid");
  expect(() => editedPaymentDate("2026-11-15", record, now)).toThrow("payment_date_future");
});
