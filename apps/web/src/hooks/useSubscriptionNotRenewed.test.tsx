import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SubscriptionNotRenewedButton } from "@/components/subscriptions/SubscriptionNotRenewedButton";
import { useSubscriptionNotRenewed } from "@/hooks/useSubscriptionNotRenewed";
import { queryKeys } from "@/lib/queryKeys";
import { canMarkSubscriptionNotRenewed } from "@/lib/subscriptionNotRenewed";
import type { Subscription } from "@/types";

const mocks = vi.hoisted(() => ({ update: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { update: mocks.update } }));
vi.mock("@/lib/toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));

const sub = { id: "service", name: "Streaming", user: "owner", inactive: false } as Subscription;
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function harness(paid = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.subscriptions.all("owner"), [sub]);
  const paidRecord = { id: "paid", paid_at: "2026-10-01T12:00:00", amount: 100 };
  client.setQueryData(queryKeys.paymentRecords.all("owner"), [paidRecord]);
  const onDone = vi.fn();
  function Harness() {
    const actions = useSubscriptionNotRenewed(onDone);
    return <SubscriptionNotRenewedButton subscription={sub} date="2026-11-14" paid={paid} actions={actions} />;
  }
  render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  return { client, onDone, paidRecord };
}
it("marks the subscription inactive once, closes the view and preserves payment history", async () => {
  mocks.update.mockResolvedValue({ ...sub, inactive: true });
  const { client, onDone, paidRecord } = harness();
  const button = screen.getByRole("button", { name: "subscription_not_renewed · Streaming" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith("service", { inactive: true });
  expect(client.getQueryData<Subscription[]>(queryKeys.subscriptions.all("owner"))![0].inactive).toBe(true);
  expect(client.getQueryData(queryKeys.paymentRecords.all("owner"))).toEqual([paidRecord]);
  expect(mocks.success).toHaveBeenCalledWith("subscription_not_renewed_success");
});
it("keeps the subscription active and offers retry when the request fails", async () => {
  mocks.update.mockRejectedValue(new Error("offline"));
  const { client, onDone } = harness();
  fireEvent.click(screen.getByRole("button", { name: "subscription_not_renewed · Streaming" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("subscription_status_error"));
  expect(client.getQueryData<Subscription[]>(queryKeys.subscriptions.all("owner"))![0].inactive).toBe(false);
  expect(onDone).not.toHaveBeenCalled();
});
it("does not offer the action for a paid calendar entry", () => {
  harness(true);
  expect(screen.queryByRole("button", { name: "subscription_not_renewed · Streaming" })).not.toBeInTheDocument();
});
it.each([
  { inactive: true }, { user: "another-owner" }, { standalone_payment_id: "payment" },
  { record_type: "credit" }, { expand: { cycle: { id: "one", name: "One-Time" } } },
])("does not pause an ineligible payment: %o", (overrides) => {
  expect(canMarkSubscriptionNotRenewed({ ...sub, ...overrides } as Subscription, "owner")).toBe(false);
});
