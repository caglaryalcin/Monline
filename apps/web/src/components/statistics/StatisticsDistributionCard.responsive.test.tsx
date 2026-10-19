import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import type { CategoryCostMode } from "@/lib/categoryPeriodCosts";

import { StatisticsDistributionCard } from "./StatisticsDistributionCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  // Exercise the real ResponsiveContainer; only the browser's layout/observer APIs are supplied.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 300,
    top: 0,
    left: 0,
    right: 800,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Chart() {
  const [year, setYear] = useState<number>(2026);
  const [mode, setMode] = useState<CategoryCostMode>("upcoming");
  const values =
    mode === "paid"
      ? [80, 20]
      : year === 2026
        ? [10, 90]
        : year === 2025
          ? [50, 50]
          : year === 2024
            ? [75, 25]
            : [5, 95];
  return (
    <StatisticsDistributionCard
      title="Categories"
      mainSymbol="$"
      year={year}
      years={[2026, 2025, 2024, 2023]}
      onYearChange={setYear}
      mode={mode}
      onModeChange={setMode}
      data={[
        { name: "Music", value: values[0], count: 1 },
        { name: "Storage", value: values[1], count: 1 },
      ]}
    />
  );
}

function sectorPaths(container: HTMLElement) {
  return [...container.querySelectorAll(".recharts-pie-sector path")].map((path) =>
    path.getAttribute("d"),
  );
}

it("redraws SVG sectors and keeps the visible percentages in sync with the table through repeated year and source changes", async () => {
  const user = userEvent.setup();
  const { container } = render(<Chart />);
  await screen.findByText("Music (10%)");
  let previousPaths = sectorPaths(container);
  expect(previousPaths).toHaveLength(2);
  for (const [year, share] of [
    [2025, 50],
    [2024, 75],
    [2023, 5],
    [2026, 10],
  ] as const) {
    await user.click(screen.getByRole("combobox", { name: "history_select_year" }));
    await user.click(screen.getByRole("option", { name: String(year) }));
    expect(screen.getByText(`Music (${share}%)`)).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /^Music / })).getByText(`${share}%`),
    ).toBeInTheDocument();
    const nextPaths = sectorPaths(container);
    expect(nextPaths).toHaveLength(2);
    expect(nextPaths).not.toEqual(previousPaths);
    previousPaths = nextPaths;
  }
  fireEvent.click(screen.getByRole("button", { name: "statistics_categories_paid" }));
  expect(screen.getByText("Music (80%)")).toBeInTheDocument();
  expect(sectorPaths(container)).not.toEqual(previousPaths);
  const musicSector = container.querySelector(".recharts-pie-sector")!;
  fireEvent.mouseEnter(musicSector);
  await waitFor(() => {
    const tooltip = container.querySelector(".recharts-tooltip-wrapper")!;
    expect(tooltip).toHaveStyle({ visibility: "visible" });
    expect(within(tooltip as HTMLElement).getByText("80.00 $")).toBeInTheDocument();
  });
});

it("redraws when values change inside an existing array and resets a previously active tooltip", async () => {
  const data = [
    { name: "Music", value: 10 },
    { name: "Storage", value: 90 },
  ];
  const { container, rerender } = render(
    <StatisticsDistributionCard title="Categories" mainSymbol="$" data={data} />,
  );
  await screen.findByText("Music (10%)");
  const paths = sectorPaths(container);
  fireEvent.mouseEnter(container.querySelector(".recharts-pie-sector")!);
  await waitFor(() =>
    expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveStyle({
      visibility: "visible",
    }),
  );
  data[0].value = 80;
  data[1].value = 20;
  rerender(<StatisticsDistributionCard title="Categories" mainSymbol="$" data={data} />);
  expect(screen.getByText("Music (80%)")).toBeInTheDocument();
  expect(sectorPaths(container)).not.toEqual(paths);
  expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveStyle({
    visibility: "hidden",
  });
});
