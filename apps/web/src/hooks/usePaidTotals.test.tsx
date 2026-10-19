import { act, renderHook, waitFor } from "@testing-library/react";

import { queryKeys } from "@/lib/queryKeys";
import { createQueryClientWrapper } from "@/test/query-client";
import type { PaymentRecord, Subscription } from "@/types";

import { usePaidTotals } from "./usePaidTotals";

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

const payment = {
  id: "paid",
  user: "user",
  subscription_id: "sub",
  due_date: "2026-01-01",
  paid_at: new Date(2026, 9, 18, 10).toISOString(),
  amount: 75,
} as PaymentRecord;

describe("paid summary data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    mocks.subscriptions.mockResolvedValue([
      { id: "sub", currency: "try", price: 99999, inactive: true } as Subscription,
    ]);
    mocks.currencies.mockResolvedValue([{ id: "try", is_main: true, rate: 1 }]);
    mocks.payments.mockResolvedValue([payment]);
  });
  afterEach(() => vi.useRealTimers());

  it("loads paid records and updates the totals when a payment cache changes", async () => {
    const { client, Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePaidTotals("user"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.totalYearly).toBe(75));
    expect(mocks.payments).toHaveBeenCalledWith("user");
    act(() =>
      client.setQueryData(queryKeys.paymentRecords.all("user"), [{ ...payment, amount: 25 }]),
    );
    await waitFor(() =>
      expect(result.current.data).toEqual({
        averageWeekly: 0.6,
        averageMonthly: 2.5,
        totalYearly: 25,
      }),
    );
  });

  it("shows no paid total while payments are loading instead of substituting planned prices", async () => {
    mocks.payments.mockImplementation(() => new Promise(() => {}));
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePaidTotals("user"), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.payments).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("does not report zero or estimates as paid when the payment request fails", async () => {
    mocks.payments.mockRejectedValue(new Error("Unavailable"));
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePaidTotals("user"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("makes no requests without a signed-in user", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePaidTotals(""), { wrapper: Wrapper });
    expect(mocks.payments).not.toHaveBeenCalled();
    expect(mocks.subscriptions).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("resets monthly and annual totals at the new year without reloading the page", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    const { client, Wrapper } = createQueryClientWrapper();
    client.setDefaultOptions({ queries: { staleTime: Infinity, retry: false } });
    client.setQueryData(queryKeys.subscriptions.all("user"), [{ id: "sub", currency: "try" }]);
    client.setQueryData(queryKeys.currencies.all("user"), [{ id: "try", is_main: true, rate: 1 }]);
    client.setQueryData(queryKeys.paymentRecords.all("user"), [
      { ...payment, paid_at: new Date(2026, 11, 31, 10).toISOString() },
    ]);
    const { result } = renderHook(() => usePaidTotals("user"), { wrapper: Wrapper });
    expect(result.current.data).toEqual({
      averageWeekly: 1.42,
      averageMonthly: 6.25,
      totalYearly: 75,
    });
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current.data).toEqual({ averageWeekly: 0, averageMonthly: 0, totalYearly: 0 });
  });

  it("recalculates the selected year using cached payments without new requests", async () => {
    mocks.payments.mockResolvedValue([
      payment,
      {
        ...payment,
        id: "previous-year",
        due_date: "2025-12-01",
        paid_at: new Date(2025, 11, 1).toISOString(),
        amount: 120,
      },
    ]);
    const { Wrapper } = createQueryClientWrapper();
    const { result, rerender } = renderHook(({ year }) => usePaidTotals("user", year), {
      initialProps: { year: 2026 },
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.totalYearly).toBe(75));
    rerender({ year: 2025 });
    expect(result.current.data).toEqual({
      averageWeekly: 2.26,
      averageMonthly: 10,
      totalYearly: 120,
    });
    expect(mocks.payments).toHaveBeenCalledTimes(1);
  });
});
