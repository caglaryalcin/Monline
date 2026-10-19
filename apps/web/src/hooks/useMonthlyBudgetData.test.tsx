import { renderHook, waitFor } from "@testing-library/react";

import { toDateStr } from "@/components/calendar/types";
import { monthlyBudgetFixture } from "@/test/fixtures/monthlyBudget";
import { createQueryClientWrapper } from "@/test/query-client";

import { useMonthlyBudgetData } from "./useMonthlyBudgetData";

const mocks = vi.hoisted(() => ({
  subscriptions: vi.fn(),
  currencies: vi.fn(),
  payments: vi.fn(),
}));
vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { list: mocks.subscriptions },
}));
vi.mock("@/services/currencies", () => ({ currenciesService: { list: mocks.currencies } }));
vi.mock("@/services/paymentRecords", () => ({
  paymentRecordsService: { listForUser: mocks.payments },
}));

describe("monthly budget data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptions.mockResolvedValue([]);
    mocks.currencies.mockResolvedValue([]);
    mocks.payments.mockResolvedValue([]);
  });

  it("loads account data only when enabled", async () => {
    const sample = { ...monthlyBudgetFixture().entries[0], date: toDateStr(new Date()) };
    mocks.subscriptions.mockResolvedValue([
      { ...sample.subscription, next_payment: sample.date, start_date: sample.date },
    ]);
    const { Wrapper } = createQueryClientWrapper();
    const { result, rerender } = renderHook(
      ({ enabled }) => useMonthlyBudgetData("user", true, enabled),
      { initialProps: { enabled: false }, wrapper: Wrapper },
    );
    expect(mocks.subscriptions).not.toHaveBeenCalled();
    expect(mocks.payments).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.subscriptions).toHaveBeenCalledWith("user");
    expect(mocks.currencies).toHaveBeenCalledWith("user");
    expect(mocks.payments).toHaveBeenCalledWith("user");
    expect(result.current.entries[0]).toMatchObject({ amount: sample.amount, status: "pending" });
  });

  it("reports failed payment loading so partial account data is not displayed as an unpaid total", async () => {
    mocks.payments.mockRejectedValue(new Error("Unavailable"));
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useMonthlyBudgetData("user", true), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });
});
