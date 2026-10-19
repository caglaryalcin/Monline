import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { useState } from "react";
import type * as Recharts from "recharts";

import { categoryPeriodCosts } from "@/lib/categoryPeriodCosts";
import type { PaymentRecord, Subscription } from "@/types";

import { StatisticsDistributionCard } from "./StatisticsDistributionCard";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Give the real chart a measured size; jsdom has no browser layout engine.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof Recharts>();
  const { cloneElement } = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width: number; height: number }>;
    }) => cloneElement(children, { width: 640, height: 300 }),
  };
});

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

it("updates the real pie percentages when the year dropdown filters recorded payments", async () => {
  const user = userEvent.setup();
  const now = new Date(2026, 9, 17, 12);
  const sub = (id: string) =>
    ({
      id,
      name: id,
      price: 999,
      currency: "usd",
      expand: { category: { id, name: id, user: "u" } },
    }) as Subscription;
  const payment = (
    id: string,
    subscription_id: string,
    date: string,
    amount: number,
  ): PaymentRecord => ({
    id,
    user: "u",
    subscription_id,
    due_date: date,
    paid_at: `${date}T12:00:00`,
    amount,
  });
  const records = [
    payment("a", "Music", "2026-10-03", 10),
    payment("b", "Storage", "2026-10-04", 90),
    payment("c", "Music", "2025-09-03", 90),
    payment("d", "Storage", "2025-09-04", 10),
  ];
  function Chart() {
    const [year, setYear] = useState(2026);
    const result = categoryPeriodCosts([sub("Music"), sub("Storage")], [], 12, (key) => key, now, {
      mode: "paid",
      records,
      year,
    });
    return (
      <StatisticsDistributionCard
        title="Categories"
        mainSymbol="$"
        data={result.data}
        year={year}
        years={[2026, 2025]}
        onYearChange={setYear}
        mode="paid"
        paymentCount={result.paymentCount}
      />
    );
  }
  render(<Chart />);
  expect(screen.getByText("Music (10%)")).toBeInTheDocument();
  expect(screen.getByText("Storage (90%)")).toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: "history_select_year" }));
  await user.click(screen.getByRole("option", { name: "2025" }));
  expect(screen.getByText("Music (90%)")).toBeInTheDocument();
  expect(screen.getByText("Storage (10%)")).toBeInTheDocument();
  expect(screen.queryByText("Music (10%)")).not.toBeInTheDocument();
});

it("shows updated category percentages immediately when the selected period changes", () => {
  const { rerender } = render(
    <StatisticsDistributionCard
      title="Categories"
      mainSymbol="$"
      data={[
        { name: "Streaming", value: 10 },
        { name: "Music", value: 30 },
      ]}
    />,
  );
  expect(screen.getByText("Streaming (25%)")).toBeInTheDocument();
  expect(screen.getByText("Music (75%)")).toBeInTheDocument();
  rerender(
    <StatisticsDistributionCard
      title="Categories"
      mainSymbol="$"
      data={[
        { name: "Streaming", value: 30 },
        { name: "Music", value: 10 },
      ]}
    />,
  );
  expect(screen.getByText("Streaming (75%)")).toBeInTheDocument();
  expect(screen.getByText("Music (25%)")).toBeInTheDocument();
  expect(screen.queryByText("Streaming (25%)")).not.toBeInTheDocument();
});

it("shows changed period totals even when recurring categories keep the same percentage shares", () => {
  const { rerender } = render(
    <StatisticsDistributionCard
      title="Categories"
      mainSymbol="$"
      year={2025}
      periodLabel="January — December 2025"
      data={[
        { name: "Streaming", value: 60 },
        { name: "Music", value: 180 },
      ]}
    />,
  );
  expect(screen.getAllByText("240.00 $").length).toBeGreaterThan(0);
  expect(screen.getByText("Streaming (25%)")).toBeInTheDocument();
  rerender(
    <StatisticsDistributionCard
      title="Categories"
      mainSymbol="$"
      year={2026}
      periodLabel="January — December 2026"
      data={[
        { name: "Streaming", value: 120 },
        { name: "Music", value: 360 },
      ]}
    />,
  );
  expect(screen.getAllByText("480.00 $").length).toBeGreaterThan(0);
  expect(screen.getByText("Streaming (25%)")).toBeInTheDocument();
  expect(screen.queryByText("240.00 $")).not.toBeInTheDocument();
});
