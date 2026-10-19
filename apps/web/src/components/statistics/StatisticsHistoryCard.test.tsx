import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="line" />,
  CartesianGrid: () => <div />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: ({ formatter }: { formatter?: (value: number) => [string, string] }) => (
    <div data-testid="tooltip">
      {formatter && <span data-testid="tooltip-value">{formatter(100)[0]}</span>}
    </div>
  ),
}));

import { StatisticsHistoryCard } from "./StatisticsHistoryCard";

describe("StatisticsHistoryCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17));
  });
  afterEach(() => vi.useRealTimers());
  it("renders the current year selector", () => {
    render(<StatisticsHistoryCard data={[{ name: "2026/10", cost: 100 }]} mainSymbol="$" />);
    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2026");
  });

  it("renders the line chart when data is non-empty", () => {
    render(
      <StatisticsHistoryCard
        data={[
          { name: "2026/09", cost: 100 },
          { name: "2026/10", cost: 150 },
        ]}
        mainSymbol="$"
      />,
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("renders the empty state when data is empty", () => {
    render(<StatisticsHistoryCard data={[]} mainSymbol="$" />);
    expect(screen.getByText("history_year_empty")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });
});
