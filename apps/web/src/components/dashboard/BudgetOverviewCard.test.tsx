import { render, screen, within } from "@testing-library/react";

import { monthlyBudgetFixture } from "@/test/fixtures/monthlyBudget";

import { BudgetOverviewCard } from "./BudgetOverviewCard";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span>logo</span> }));

const formatValue = (value: number) => `$${value.toFixed(2)}`;

describe("monthly budget overview", () => {
  it("lists dated subscription charges, paid and pending totals, and the month-end remainder", () => {
    const preview = monthlyBudgetFixture(new Date(2026, 9, 17));
    render(
      <BudgetOverviewCard budget={2000} entries={preview.entries} formatValue={formatValue} />,
    );
    expect(screen.getByText("$2000.00")).toBeInTheDocument();
    expect(screen.getByText("$1050.00")).toBeInTheDocument();
    expect(screen.getByText("$1490.00")).toBeInTheDocument();
    expect(screen.getByText(/budget_month_remaining: \$510.00/)).toBeInTheDocument();
    const rows = within(
      screen.getByRole("list", { name: "budget_month_subscriptions" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText("Netflix")).toBeInTheDocument();
    expect(within(rows[0]).getByText("budget_status_paid")).toBeInTheDocument();
    expect(rows[0].querySelector("time")).toHaveAttribute("dateTime", "2026-10-03");
    expect(within(rows[4]).getByText("budget_status_pending")).toBeInTheDocument();
    expect(within(rows[4]).getByText("$440.00")).toBeInTheDocument();
  });

  it("includes income in the available budget and reports an exceeded amount", () => {
    const { rerender } = render(
      <BudgetOverviewCard
        budget={1000}
        totalCredits={100}
        entries={monthlyBudgetFixture().entries}
        formatValue={formatValue}
      />,
    );
    expect(screen.getByText(/budget_exceeded_by: \$390.00/)).toBeInTheDocument();
    expect(screen.getByText(/credits_this_month: \+\$100.00/)).toBeInTheDocument();
    rerender(<BudgetOverviewCard budget={2000} entries={[]} formatValue={formatValue} />);
    expect(screen.getByText("budget_month_empty")).toBeInTheDocument();
  });

  it("keeps the list visible without a budget and does not mark scheduled charges as paid", () => {
    const entry = { ...monthlyBudgetFixture().entries[0], status: "scheduled" as const };
    render(<BudgetOverviewCard budget={0} entries={[entry]} formatValue={formatValue} />);
    expect(screen.getByText("no_budget_set")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("budget_status_scheduled")).toBeInTheDocument();
    expect(screen.queryByText("budget_status_paid")).not.toBeInTheDocument();
    expect(screen.queryByText(/budget_exceeded_by/)).not.toBeInTheDocument();
  });

  it("shows loading and errors without presenting incomplete totals as zero spending", () => {
    const { rerender } = render(
      <BudgetOverviewCard budget={1000} isLoading formatValue={formatValue} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    rerender(<BudgetOverviewCard budget={1000} hasError formatValue={formatValue} />);
    expect(screen.getByRole("alert")).toHaveTextContent("budget_list_error");
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });
});
