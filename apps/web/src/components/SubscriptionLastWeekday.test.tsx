import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SubscriptionFormModal } from "@/components/SubscriptionFormModal";
import { displayDateInput } from "@/lib/dateInput";
import { queryKeys } from "@/lib/queryKeys";
import type { Currency, Subscription } from "@/types";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/hooks/useLogoSearch", () => ({
  useLogoSearch: () => ({ logoUrl: "", logoPreview: null, resolveLogoFile: async () => null }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/components/SubscriptionLogoSection", () => ({ SubscriptionLogoSection: () => null }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { update: mocks.update } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const currency: Currency = {
  id: "eur",
  code: "EUR",
  symbol: "€",
  name: "Euro",
  rate: 1,
  is_main: true,
  user: "owner",
};
const sub: Subscription = {
  id: "sub",
  user: "owner",
  name: "Fixture",
  price: 100,
  currency: "eur",
  category: "cat",
  cycle: "monthly",
  frequency: 1,
  next_payment: "2027-01-31",
  start_date: "2026-12-31",
  auto_renew: true,
  inactive: false,
  notify: false,
  notify_days_before: 3,
  expand: { cycle: { id: "monthly", name: "Monthly" } },
};
let client: QueryClient;
function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(queryKeys.cycles(), [
    { id: "monthly", name: "Monthly" },
    { id: "last", name: "Last-Weekday" },
  ]);
  render(
    <QueryClientProvider client={client}>
      <SubscriptionFormModal
        sub={sub}
        userId="owner"
        currencies={[currency]}
        categories={[{ id: "cat", name: "Fixture", user: "owner" }]}
        paymentMethods={[]}
        household={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue({ id: "sub" });
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  cleanup();
  client?.clear();
});
async function selectRule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "billing_period" }));
  await user.click(screen.getByRole("option", { name: "billing_preset_last_weekday" }));
}
it("normalizes the chosen month and saves the new period without changing its price", async () => {
  mount();
  const user = userEvent.setup();
  await selectRule(user);
  await waitFor(() =>
    expect(screen.getByLabelText("next_payment")).toHaveValue(displayDateInput("2027-01-29")),
  );
  expect(screen.getByText("billing_last_weekday_hint")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][0]).toBe("sub");
  expect(mocks.update.mock.calls[0][1]).toMatchObject({
    cycle: "last",
    frequency: 1,
    next_payment: "2027-01-29",
    price: 100,
  });
});
it("recalculates the last weekday when another month is entered", async () => {
  mount();
  const user = userEvent.setup();
  await selectRule(user);
  fireEvent.change(screen.getByLabelText("next_payment"), {
    target: { value: displayDateInput("2027-02-28") },
  });
  fireEvent.blur(screen.getByLabelText("next_payment"));
  await waitFor(() =>
    expect(screen.getByLabelText("next_payment")).toHaveValue(displayDateInput("2027-02-26")),
  );
});
it("lets a subscription return to its ordinary monthly period", async () => {
  mount();
  const user = userEvent.setup();
  await selectRule(user);
  await user.click(screen.getByRole("combobox", { name: "billing_period" }));
  await user.click(screen.getByRole("option", { name: "billing_preset_monthly" }));
  expect(screen.queryByText("billing_last_weekday_hint")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][1]).toMatchObject({
    cycle: "monthly",
    frequency: 1,
    next_payment: "2027-01-29",
  });
});
