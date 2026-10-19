import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as Recharts from "recharts";

const capturedTooltipProps: Record<string, unknown> = {};
const capturedForecastProps: Record<string, unknown> = {};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("recharts", async (importOriginal) => ({
  DefaultTooltipContent: (await importOriginal<typeof Recharts>()).DefaultTooltipContent,
  Dot: (await importOriginal<typeof Recharts>()).Dot,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-values={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Area: (props: Record<string, unknown>) => {
    if (props.dataKey === "forecast") Object.assign(capturedForecastProps, props);
    return <div data-testid={props.dataKey === "forecast" ? "forecast-area" : "area"} />;
  },
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: (props: Record<string, unknown>) => {
    Object.assign(capturedTooltipProps, props);
    return <div data-testid="tooltip" />;
  },
}));

import { CostHistoryCard } from "./CostHistoryCard";

describe("CostHistoryCard", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17));
  });
  afterEach(() => vi.useRealTimers());
  it("shows even one recorded month as a graph without a table or summary boxes", () => {
    render(
      <CostHistoryCard
        data={[{ name: "2026/10", cost: 120, isCurrent: true }]}
        formatValue={(value) => "$" + value}
      />,
    );
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2026");
    expect(screen.queryByText("history_current_estimate")).not.toBeInTheDocument();
  });
  it("renders the chart when data is non-empty", () => {
    const data = [
      { name: "2026/09", cost: 100 },
      { name: "2026/10", cost: 150 },
    ];

    render(<CostHistoryCard data={data} formatValue={(v) => `$${v}`} />);

    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2026");
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("renders the empty state when data is empty", () => {
    render(<CostHistoryCard data={[]} formatValue={(v) => `$${v}`} />);

    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2026");
    expect(screen.getByText("history_year_empty")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("tooltip formatter calls formatValue", () => {
    const data = [
      { name: "2026/09", cost: 42 },
      { name: "2026/10", cost: 43 },
    ];
    render(<CostHistoryCard data={data} formatValue={(v) => `$${v}`} />);

    const formatter = capturedTooltipProps.formatter as (value: number) => [string, string];
    expect(formatter).toBeDefined();
    const result = formatter(42);
    expect(result).toEqual(["$42", "amount"]);
    expect(screen.queryByText("history_monthly_cost")).not.toBeInTheDocument();
  });

  it("keeps all twelve months and leaves records from other years out of the graph", () => {
    render(
      <CostHistoryCard
        data={[
          { name: "2025/04", cost: 999 },
          { name: "2026/06", cost: 70 },
          { name: "2026/10", cost: 120 },
        ]}
        formatValue={String}
      />,
    );
    const data = JSON.parse(screen.getByTestId("area-chart").getAttribute("data-values") ?? "[]");
    expect(data).toHaveLength(12);
    expect(data[0]).toEqual({ name: "2026/01", cost: null });
    expect(data[5]).toEqual({ name: "2026/06", cost: 70 });
    expect(data[9]).toEqual({ name: "2026/10", cost: 120 });
    expect(data[11]).toEqual({ name: "2026/12", cost: null });
    expect(data.some((point: { cost: number | null }) => point.cost === 999)).toBe(false);
  });

  it("switches the complete chart to the year selected from the dropdown", async () => {
    const user = userEvent.setup();
    render(
      <CostHistoryCard
        data={[
          { name: "2025/01", cost: 100 },
          { name: "2025/12", cost: 200 },
          { name: "2026/10", cost: 300 },
        ]}
        formatValue={String}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "history_select_year" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "2026",
      "2025",
    ]);
    await user.click(screen.getByRole("option", { name: "2025" }));
    const data = JSON.parse(screen.getByTestId("area-chart").getAttribute("data-values")!);
    expect(data).toHaveLength(12);
    expect(data[0]).toEqual({ name: "2025/01", cost: 100 });
    expect(data[11]).toEqual({ name: "2025/12", cost: 200 });
    expect(data.every((point: { name: string }) => point.name.startsWith("2025/"))).toBe(true);
  });

  it("automatically opens the new calendar year when the year changes", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    render(<CostHistoryCard data={[{ name: "2026/12", cost: 100 }]} formatValue={String} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("2026");
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(screen.getByRole("combobox")).toHaveTextContent("2027");
    expect(screen.getByText("history_year_empty")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("shares a controlled year selection with the dashboard summary", async () => {
    const data = [
      { name: "2025/12", cost: 100 },
      { name: "2026/10", cost: 200 },
    ];
    const onYearChange = vi.fn();
    const { rerender } = render(
      <CostHistoryCard
        data={data}
        formatValue={String}
        selectedYear={2025}
        onYearChange={onYearChange}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("2025");
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "2026" }));
    expect(onYearChange).toHaveBeenCalledExactlyOnceWith(2026);
    rerender(
      <CostHistoryCard
        data={data}
        formatValue={String}
        selectedYear={2026}
        onYearChange={onYearChange}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("2026");
    const points = JSON.parse(screen.getByTestId("area-chart").getAttribute("data-values")!);
    expect(points.every((point: { name: string }) => point.name.startsWith("2026/"))).toBe(true);
  });

  it("draws a separate forecast series and labels only the actual future point as upcoming", () => {
    render(
      <CostHistoryCard
        data={[{ name: "2026/10", cost: 100 }]}
        forecasts={[
          { name: "2026/11", cost: 150 },
          { name: "2026/12", cost: 200 },
        ]}
        formatValue={(value) => `$${value}`}
      />,
    );
    expect(screen.getByTestId("forecast-area")).toBeInTheDocument();
    expect(screen.getByText("history_upcoming_payment")).toBeInTheDocument();
    const points = JSON.parse(screen.getByTestId("area-chart").getAttribute("data-values")!);
    expect(points[10]).toMatchObject({ cost: null, forecast: 150, isForecast: true });
    expect(points[11]).toMatchObject({ cost: null, forecast: 200, isForecast: true });
    const content = capturedTooltipProps.content as (
      props: Record<string, unknown>,
    ) => React.ReactElement;
    const previous = render(
      content({
        ...capturedTooltipProps,
        label: "2026/10",
        payload: [
          { dataKey: "cost", name: "cost", value: 100, payload: points[9] },
          { dataKey: "forecast", name: "forecast", value: 100, payload: points[9] },
        ],
      }),
    );
    expect(within(previous.container).getByText("amount")).toBeInTheDocument();
    expect(
      within(previous.container).queryByText("history_upcoming_payment"),
    ).not.toBeInTheDocument();
    previous.unmount();
    const future = render(
      content({
        ...capturedTooltipProps,
        label: "2026/11",
        payload: [{ dataKey: "forecast", name: "forecast", value: 150, payload: points[10] }],
      }),
    );
    expect(within(future.container).getByText("history_upcoming_payment")).toBeInTheDocument();
    expect(within(future.container).getByText("$150")).toBeInTheDocument();
  });

  it("shows a forecast even before historical payments exist, but hides it for past years", () => {
    const { rerender } = render(
      <CostHistoryCard data={[]} forecasts={[{ name: "2026/11", cost: 0 }]} formatValue={String} />,
    );
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.queryByText("history_year_empty")).not.toBeInTheDocument();
    rerender(
      <CostHistoryCard
        data={[{ name: "2025/12", cost: 100 }]}
        selectedYear={2025}
        forecasts={[{ name: "2026/11", cost: 150 }]}
        formatValue={String}
      />,
    );
    expect(screen.queryByTestId("forecast-area")).not.toBeInTheDocument();
    expect(screen.queryByText("history_upcoming_payment")).not.toBeInTheDocument();
  });

  it.each(["dot", "activeDot"])("does not draw %s markers for missing forecast values", (key) => {
    render(
      <CostHistoryCard
        data={[{ name: "2026/10", cost: 100 }]}
        forecasts={[{ name: "2026/11", cost: 150 }]}
        formatValue={String}
      />,
    );
    const marker = capturedForecastProps[key] as (
      props: Record<string, unknown>,
    ) => React.ReactElement;
    const { container } = render(
      <svg>
        {marker({ cx: 10, cy: null, payload: { cost: 80 } })}
        {marker({ cx: 20, cy: undefined, payload: { cost: 90 } })}
        {marker({ cx: 30, cy: 50, payload: { cost: 100, forecast: 100 } })}
        {marker({ cx: 40, cy: 0, payload: { cost: null, forecast: 0, isForecast: true } })}
      </svg>,
    );
    const dots = container.querySelectorAll("circle");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("fill", "hsl(var(--primary))");
    expect(dots[1]).toHaveAttribute("fill", "hsl(var(--muted-foreground))");
    expect(dots[1]).toHaveAttribute("cy", "0");
  });
});
