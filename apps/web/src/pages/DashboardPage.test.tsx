import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { queryKeys } from "@/lib/queryKeys";
import type * as Utils from "@/lib/utils";
import { createQueryClientWrapper } from "@/test/query-client";
import type { User } from "@/types";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  useSummaryData: vi.fn(),
  usePaidTotals: vi.fn(),
  useYearlyCosts: vi.fn(),
  useDashboardDerivedData: vi.fn(),
  user: {
    id: "user-1",
    name: "Daniel",
    email: "daniel@example.com",
  } as User | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useSummaryData", () => ({
  useSummaryData: mocks.useSummaryData,
}));
vi.mock("@/hooks/usePaidTotals", () => ({ usePaidTotals: mocks.usePaidTotals }));

vi.mock("@/hooks/useYearlyCosts", () => ({
  useYearlyCosts: mocks.useYearlyCosts,
}));
vi.mock("@/hooks/useMonthlyBudgetData", () => ({
  useMonthlyBudgetData: () => ({ entries: [], isLoading: false, hasError: false }),
}));

vi.mock("@/components/dashboard/useDashboardDerivedData", () => ({
  useDashboardDerivedData: mocks.useDashboardDerivedData,
}));

vi.mock("@/services/yearlyCosts", () => ({
  yearlyCostsService: {
    snapshot: mocks.snapshot,
  },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof Utils>();
  return {
    ...actual,
    formatPrice: (value: number, symbol: string) => `${value} ${symbol}`,
  };
});

vi.mock("@/components/dashboard/SummaryCard", () => ({
  SummaryCard: ({ title, value }: { title: string; value: string }) => (
    <div>
      {title}:{value}
    </div>
  ),
}));

vi.mock("@/components/dashboard/CostHistoryCard", () => ({
  CostHistoryCard: ({
    data,
    selectedYear,
    onYearChange,
    forecasts,
  }: {
    data: unknown[];
    selectedYear: number;
    onYearChange: (year: number) => void;
    forecasts?: { name: string; cost: number }[];
  }) => (
    <div>
      history:{data.length}
      <span>forecast:{forecasts?.[0]?.cost}</span>
      <select
        aria-label="history-year"
        value={selectedYear}
        onChange={(event) => onYearChange(Number(event.target.value))}
      >
        <option value={2026}>2026</option>
        <option value={2025}>2025</option>
      </select>
    </div>
  ),
}));

vi.mock("@/components/dashboard/BudgetOverviewCard", () => ({
  BudgetOverviewCard: ({ budget }: { budget: number }) => <div>budget:{budget}</div>,
}));

import { DashboardPage } from "./DashboardPage";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    mocks.user = { id: "user-1", name: "Daniel", username: "daniel", email: "daniel@example.com" };
    mocks.snapshot.mockResolvedValue(undefined);
    mocks.useSummaryData.mockReturnValue({
      data: {
        count: 4,
        totalMonthly: 50,
        totalYearly: 600,
        totalWeekly: 12,
        totalDaily: 2,
        nextMonthTotal: 90,
        forecasts: [
          { name: "2026/11", cost: 90 },
          { name: "2026/12", cost: 100 },
        ],
        mainSymbol: "$",
      },
      isLoading: false,
    });
    mocks.useYearlyCosts.mockReturnValue({ data: [] });
    mocks.usePaidTotals.mockReturnValue({
      data: { averageWeekly: 7, averageMonthly: 25, totalYearly: 125 },
      isLoading: false,
    });
    mocks.useDashboardDerivedData.mockReturnValue({
      budget: 100,
      budgetUsed: 50,
      chartData: [{ month: "Jan", value: 50 }],
      isOverBudget: false,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("uses the graph's selected year for all three paid summary cards", () => {
    mocks.usePaidTotals.mockImplementation((_userId: string, year: number) => ({
      data:
        year === 2025
          ? { averageWeekly: 10, averageMonthly: 40, totalYearly: 480 }
          : { averageWeekly: 7, averageMonthly: 25, totalYearly: 125 },
      isLoading: false,
    }));
    const { Wrapper } = createQueryClientWrapper();
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(mocks.usePaidTotals).toHaveBeenLastCalledWith("user-1", 2026);
    fireEvent.change(screen.getByRole("combobox", { name: "history-year" }), {
      target: { value: "2025" },
    });
    expect(mocks.usePaidTotals).toHaveBeenLastCalledWith("user-1", 2025);
    expect(screen.getByText("total_weekly:10 $")).toBeInTheDocument();
    expect(screen.getByText("total_monthly:40 $")).toBeInTheDocument();
    expect(screen.getByText("total_yearly:480 $")).toBeInTheDocument();
    expect(screen.getByText("next_month_cost:90 $")).toBeInTheDocument();
    expect(screen.getByText("forecast:90")).toBeInTheDocument();
  });

  it("renders dashboard data and triggers an initial yearly cost snapshot when empty", async () => {
    const { client, Wrapper } = createQueryClientWrapper();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);

    render(<DashboardPage />, { wrapper: Wrapper });

    expect(screen.getByText("total_weekly:7 $")).toBeInTheDocument();
    expect(screen.getByText("total_monthly:25 $")).toBeInTheDocument();
    expect(screen.getByText("total_yearly:125 $")).toBeInTheDocument();
    expect(screen.getByText("next_month_cost:90 $")).toBeInTheDocument();
    expect(screen.queryByText("total_yearly:600 $")).not.toBeInTheDocument();
    expect(screen.getByText("history:1")).toBeInTheDocument();
    expect(screen.getByText("budget:100")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dashboard_show/ })).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard_preview_label")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.snapshot).toHaveBeenCalledTimes(1);
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.yearlyCosts.all("user-1"),
    });
  });

  it("renders safe fallbacks when user is null and summary is loading", () => {
    mocks.usePaidTotals.mockReturnValue({ data: undefined, isLoading: true });
    mocks.user = null;
    mocks.useSummaryData.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { Wrapper } = createQueryClientWrapper();
    render(<DashboardPage />, { wrapper: Wrapper });

    expect(screen.getAllByText((text) => text.includes("total_monthly:—")).length).toBeGreaterThan(
      0,
    );
  });

  it("uses default format symbol if mainSymbol is missing", () => {
    mocks.useSummaryData.mockReturnValue({
      data: {
        count: 4,
        totalMonthly: 50,
        totalYearly: 600,
        totalWeekly: 12,
        totalDaily: 2,
        nextMonthTotal: 90,
        // no mainSymbol
      },
      isLoading: false,
    });

    mocks.user = { id: "user-2", email: "test@example.com", name: "", username: "" };

    const { Wrapper } = createQueryClientWrapper();
    render(<DashboardPage />, { wrapper: Wrapper });

    expect(screen.getByText("total_monthly:25 $")).toBeInTheDocument();
  });
});
