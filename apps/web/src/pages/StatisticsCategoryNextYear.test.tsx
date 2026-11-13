import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ subscriptions: vi.fn(), currencies: vi.fn(), records: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u" } }) }));
vi.mock("@/hooks/useLocalToday", () => ({ useLocalToday: () => "2026-11-12" }));
vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { list: mocks.subscriptions },
}));
vi.mock("@/services/currencies", () => ({ currenciesService: { list: mocks.currencies } }));
vi.mock("@/services/paymentRecords", () => ({
  paymentRecordsService: { listForUser: mocks.records },
}));
vi.mock("@/components/statistics/StatisticsPaymentsCard", () => ({
  StatisticsPaymentsCard: () => null,
}));
vi.mock("@/components/statistics/StatisticsDistributionCard", () => ({
  StatisticsDistributionCard: ({
    year,
    years,
    onYearChange,
    mode,
    onModeChange,
    data,
  }: {
    year: number;
    years: number[];
    onYearChange: (year: number) => void;
    mode: string;
    onModeChange: (mode: "paid" | "upcoming") => void;
    data: { name: string; value: number }[];
  }) => (
    <section aria-label="categories">
      <select
        aria-label="category-year"
        value={year}
        onChange={(event) => onYearChange(Number(event.target.value))}
      >
        {years.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <button onClick={() => onModeChange("upcoming")}>upcoming</button>
      <button onClick={() => onModeChange("paid")}>paid</button>
      <span>{mode}</span>
      {data.map((row) => (
        <p key={row.name}>
          {row.name}:{row.value}
        </p>
      ))}
    </section>
  ),
}));

import { StatisticsPage } from "./StatisticsPage";

it("shows next year's category forecast and returns to this year's recorded payments", async () => {
  mocks.currencies.mockResolvedValue([]);
  mocks.records.mockResolvedValue([
    {
      id: "record",
      subscription_id: "online",
      user: "u",
      due_date: "2026-10-20",
      paid_at: "2026-10-20T12:00:00",
      amount: 80,
    },
  ]);
  mocks.subscriptions.mockResolvedValue([
    {
      id: "online",
      name: "Streaming",
      price: 100,
      currency: "",
      frequency: 1,
      auto_renew: true,
      start_date: "2026-01-01",
      next_payment: "2026-11-20",
      inactive: false,
      expand: { cycle: { name: "Monthly" }, category: { id: "video", name: "Video" } },
    },
  ]);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StatisticsPage />
    </QueryClientProvider>,
  );
  const categories = within(await screen.findByRole("region", { name: "categories" }));
  expect(categories.queryByRole("option", { name: "2027" })).not.toBeInTheDocument();
  fireEvent.click(categories.getByRole("button", { name: "upcoming" }));
  fireEvent.change(categories.getByRole("combobox"), { target: { value: "2027" } });
  await waitFor(() => expect(categories.getByText("Video:1200")).toBeInTheDocument());
  fireEvent.click(categories.getByRole("button", { name: "paid" }));
  expect(categories.getByRole("combobox")).toHaveValue("2026");
  expect(categories.queryByRole("option", { name: "2027" })).not.toBeInTheDocument();
  expect(categories.getByText("Video:80")).toBeInTheDocument();
});
