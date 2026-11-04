import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { QuickPaymentDialog } from "@/components/QuickPaymentDialog";
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { useQuickPayments } from "@/hooks/useQuickPayments";
import type { PaymentRecord, Subscription } from "@/types";

const mocks = vi.hoisted(() => ({ list: vi.fn(), pay: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner", payment_tracking: true } }) }));
vi.mock("@/hooks/useLocalToday", () => ({ useLocalToday: () => "2026-11-04" }));
vi.mock("@/services/paymentRecords", () => ({ paymentRecordsService: { listForUser: mocks.list, quickPay: mocks.pay } }));
vi.mock("@/lib/toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span>logo</span> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (key: string, values?: Record<string, unknown>) => `${key}${values ? " " + Object.values(values).join(" ") : ""}`,
  i18n: { language: "en", resolvedLanguage: "en" },
}) }));

const sub = {
  id: "plan", user: "owner", name: "Test Plan", price: 100, currency: "try", cycle: "monthly", frequency: 1,
  next_payment: "2026-11-06", start_date: "2026-01-06", auto_renew: true, inactive: false,
  expand: { cycle: { id: "monthly", name: "Monthly" }, currency: { id: "try", code: "TRY", name: "Lira", symbol: "₺", rate: 1 } },
} as Subscription;
const noop = () => {};

function Harness({ dashboard = false }: { dashboard?: boolean }) {
  const quick = useQuickPayments();
  return <>
    {dashboard
      ? <BudgetOverviewCard budget={1000} entries={[{ id: "plan:2026-11-06", subscription: sub, date: "2026-11-06", amount: 100, status: "pending" }]} formatValue={String} quickPayments={quick.actions} />
      : <SubscriptionCard sub={sub} onEdit={noop} onClone={noop} onRenew={noop} onHistory={noop} onDelete={noop} quickPayments={quick.actions} />}
    <QuickPaymentDialog target={quick.target} pending={quick.pending} onClose={quick.close} onConfirm={quick.confirm} />
  </>;
}
function mount(dashboard = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Harness dashboard={dashboard} /></QueryClientProvider>);
  return client;
}
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([]); });
afterEach(cleanup);

it("opens confirmation from the subscription card and cancel never writes a payment", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: /quick_payment_button Test Plan/ }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Test Plan");
  expect(screen.getByRole("alertdialog")).toHaveTextContent("100");
  expect(mocks.pay).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(mocks.pay).not.toHaveBeenCalled();
});

it.each([false, true])("confirms once and refreshes payment state, dashboard=%s", async (dashboard) => {
  let resolve!: (value: { payment_id: string }) => void;
  mocks.pay.mockImplementation(() => new Promise((done) => { resolve = done; }));
  mount(dashboard);
  fireEvent.click(await screen.findByRole("button", { name: /quick_payment_button Test Plan/ }));
  const confirm = screen.getByRole("button", { name: "mark_as_paid" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => expect(mocks.pay).toHaveBeenCalledTimes(1));
  expect(mocks.pay).toHaveBeenCalledWith("plan", expect.objectContaining({
    due_date: "2026-11-06", expected_amount: 100, expected_currency: "try",
  }));
  expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
  const paid = { id: "saved", subscription_id: sub.id, user: sub.user, due_date: sub.next_payment, paid_at: "2026-11-04T12:00:00Z", amount: 100 } as PaymentRecord;
  mocks.list.mockResolvedValue([paid]);
  resolve({ payment_id: "saved" });
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByRole("button", { name: /quick_payment_button Test Plan/ })).not.toBeInTheDocument());
  expect(mocks.success).toHaveBeenCalledWith("marked_as_paid");
});

it("does not report a failed payment as paid", async () => {
  mocks.pay.mockRejectedValue(new Error("quick_payment_changed"));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: /quick_payment_button Test Plan/ }));
  fireEvent.click(screen.getByRole("button", { name: "mark_as_paid" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("quick_payment_changed"));
  expect(mocks.success).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: /quick_payment_button Test Plan/ })).toBeInTheDocument();
});
