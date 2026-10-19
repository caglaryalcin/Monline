import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/statistics/constants", () => ({
  STATISTICS_CATEGORY_COLORS: ["#ff0000", "#00ff00", "#0000ff"],
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ label }: { label?: (entry: { name: string; percent: number }) => string }) => (
    <div data-testid="pie">
      {label && <span data-testid="pie-label">{label({ name: "Netflix", percent: 0.5 })}</span>}
    </div>
  ),
  Label: () => null,
  Cell: () => <div data-testid="cell" />,
  Tooltip: ({ formatter }: { formatter?: (value: number) => string }) => (
    <div data-testid="tooltip">
      {formatter && <span data-testid="tooltip-value">{formatter(15)}</span>}
    </div>
  ),
  Legend: () => <div data-testid="legend" />,
}));

import { StatisticsDistributionCard } from "./StatisticsDistributionCard";

describe("StatisticsDistributionCard", () => {
  it("keeps multiple categories expanded and collapses only the clicked category", async () => {
    const user = userEvent.setup();
    render(
      <StatisticsDistributionCard
        title="Categories"
        mainSymbol="$"
        year={2026}
        data={[
          { name: "AI", value: 100 },
          { name: "Video", value: 50 },
        ]}
        categoryDetails={{
          AI: [
            { id: "chatgpt", name: "Chatgpt", value: 60 },
            { id: "claude", name: "Claude", value: 40 },
          ],
          Video: [{ id: "youtube", name: "YouTube Premium", value: 50 }],
        }}
      />,
    );
    await user.click(screen.getByText("AI"));
    await user.click(screen.getByText("Video"));
    expect(screen.getByText("Chatgpt")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("YouTube Premium")).toBeInTheDocument();
    expect(screen.getByText("AI").closest("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Video").closest("button")).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByText("AI"));
    expect(screen.queryByText("Chatgpt")).not.toBeInTheDocument();
    expect(screen.getByText("YouTube Premium")).toBeInTheDocument();
    expect(screen.getByText("Video").closest("button")).toHaveAttribute("aria-expanded", "true");
  });
  it("renders the title", () => {
    render(
      <StatisticsDistributionCard
        data={[{ name: "Netflix", value: 15 }]}
        mainSymbol="$"
        title="Distribution"
      />,
    );
    expect(screen.getByText("Distribution")).toBeInTheDocument();
  });

  it("renders the pie chart when data is non-empty", () => {
    render(
      <StatisticsDistributionCard
        data={[
          { name: "A", value: 10 },
          { name: "B", value: 20 },
        ]}
        mainSymbol="$"
        title="By Category"
      />,
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("renders the empty state when data is empty", () => {
    render(<StatisticsDistributionCard data={[]} mainSymbol="$" title="By Category" />);
    expect(screen.getByText("no_results")).toBeInTheDocument();
    expect(screen.queryByTestId("pie-chart")).not.toBeInTheDocument();
  });
});
