import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createQueryClientWrapper } from "@/test/query-client";

const mocks = vi.hoisted(() => ({
  subscriptions: vi.fn(),
  currencies: vi.fn(),
  payments: vi.fn(),
  user: { id: "user" } as { id: string } | null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { list: mocks.subscriptions },
}));
vi.mock("@/services/currencies", () => ({ currenciesService: { list: mocks.currencies } }));
vi.mock("@/services/paymentRecords", () => ({
  paymentRecordsService: { listForUser: mocks.payments },
}));
vi.mock("@/components/statistics/StatisticsDistributionCard", () => ({
  StatisticsDistributionCard: ({
    title,
    data,
    year,
    onYearChange,
    mode,
    onModeChange,
  }: {
    title: string;
    data: { name: string; value: number }[];
    year: number;
    onYearChange: (value: number) => void;
    mode: string;
    onModeChange: (value: "paid" | "upcoming") => void;
  }) => (
    <div>
      {title}
      <span>category-total:{data.reduce((sum, item) => sum + item.value, 0)}</span>
      <span>category-mode:{mode}</span>
      {data.map((item) => (
        <span key={item.name}>
          category-share:{item.name}:
          {Math.round((item.value / data.reduce((sum, row) => sum + row.value, 0)) * 100)}
        </span>
      ))}
      <button onClick={() => onModeChange("paid")}>recorded-categories</button>
      <button onClick={() => onModeChange("upcoming")}>upcoming-categories</button>
      <select
        aria-label="year"
        value={year}
        onChange={(event) => onYearChange(Number(event.target.value))}
      >
        {[2026, 2025].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  ),
}));
vi.mock("@/components/statistics/StatisticsPaymentsCard", () => ({
  StatisticsPaymentsCard: ({
    data,
    year,
    onYearChange,
  }: {
    data: { paid: unknown[]; upcoming: unknown[] };
    year: number;
    onYearChange: (year: number) => void;
  }) => (
    <div>
      monthly-payments
      <span>monthly-year:{year}</span>
      <span>
        monthly-count:{data.paid.length}:{data.upcoming.length}
      </span>
      <button onClick={() => onYearChange(2025)}>monthly-previous-year</button>
    </div>
  ),
}));

import { StatisticsPage } from "./StatisticsPage";

describe("StatisticsPage", () => {
  it("connects the year selector to actual recorded category payments", async () => {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    const previous = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const sub = (id: string) => ({
      id,
      name: id,
      price: 999,
      frequency: 1,
      next_payment: "2026-10-05",
      expand: { category: { id, name: id }, cycle: { name: "Monthly" } },
    });
    mocks.subscriptions.mockResolvedValue([sub("Music"), sub("Storage")]);
    mocks.payments.mockResolvedValue([
      {
        id: "a",
        subscription_id: "Music",
        due_date: "current-a",
        paid_at: current.toISOString(),
        amount: 10,
      },
      {
        id: "b",
        subscription_id: "Storage",
        due_date: "current-b",
        paid_at: current.toISOString(),
        amount: 90,
      },
      {
        id: "c",
        subscription_id: "Music",
        due_date: "previous-a",
        paid_at: previous.toISOString(),
        amount: 90,
      },
      {
        id: "d",
        subscription_id: "Storage",
        due_date: "previous-b",
        paid_at: previous.toISOString(),
        amount: 10,
      },
    ]);
    const { Wrapper } = createQueryClientWrapper();
    render(<StatisticsPage />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "recorded-categories" }));
    await waitFor(() => expect(screen.getByText("category-total:100")).toBeInTheDocument());
    expect(screen.getByText("category-share:Music:10")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "year" }), { target: { value: "2025" } });
    expect(screen.getByText("category-total:100")).toBeInTheDocument();
    expect(screen.getByText("category-share:Music:90")).toBeInTheDocument();
    expect(screen.getByText("category-mode:paid")).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 12));
    vi.clearAllMocks();
    mocks.user = { id: "user" };
    const now = new Date();
    const subscription = {
      id: "active",
      inactive: false,
      next_payment: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-25`,
      auto_renew: true,
      start_date: "2020-01-01",
      price: 10,
      frequency: 1,
      name: "A",
      expand: { cycle: { name: "Monthly" } },
    };
    mocks.subscriptions.mockResolvedValue([
      subscription,
      { ...subscription, id: "paused", inactive: true },
    ]);
    mocks.currencies.mockResolvedValue([]);
    mocks.payments.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps costs by category and replaces the old cards with the month-by-month payment view", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<StatisticsPage />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("cost_by_category")).toBeInTheDocument());
    expect(screen.getByText("monthly-payments")).toBeInTheDocument();
    expect(screen.getByText("monthly-year:2026")).toBeInTheDocument();
    expect(screen.getByText("monthly-count:12:12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "monthly-previous-year" }));
    expect(screen.getByText("monthly-year:2025")).toBeInTheDocument();
    expect(screen.getByText("monthly-count:12:12")).toBeInTheDocument();
    expect(mocks.subscriptions).toHaveBeenCalledWith("user");
    expect(mocks.payments).toHaveBeenCalledWith("user");
    expect(screen.getByText("category-total:0")).toBeInTheDocument();
    expect(screen.getByText("category-mode:paid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "upcoming-categories" }));
    expect(screen.getByRole("combobox", { name: "year" })).toHaveValue("2026");
    expect(screen.getByText("category-total:30")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "year" }), { target: { value: "2025" } });
    expect(screen.getByText("category-total:0")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "year" }), { target: { value: "2026" } });
    expect(screen.getByText("category-total:30")).toBeInTheDocument();
    expect(screen.queryByText("total_yearly")).not.toBeInTheDocument();
    expect(screen.queryByText("history_last_six_months")).not.toBeInTheDocument();
  });

  it("does not request account data without an authenticated user", () => {
    mocks.user = null;
    const { Wrapper } = createQueryClientWrapper();
    render(<StatisticsPage />, { wrapper: Wrapper });
    expect(screen.queryByRole("heading", { name: "statistics" })).not.toBeInTheDocument();
    expect(mocks.subscriptions).not.toHaveBeenCalled();
    expect(mocks.payments).not.toHaveBeenCalled();
  });
});
