import { render, screen, within } from "@testing-library/react";

import { CostHistoryTooltip } from "./CostHistoryTooltip";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("separates paid and pending items and totals and labels overdue payments", () => {
  render(
    <CostHistoryTooltip
      month="2026/11"
      language="en"
      formatValue={(value) => `$${value}`}
      details={{
        paid: [{ id: "paid", name: "Cloud Pro", date: "2026-11-01", amount: 40 }],
        pending: [{ id: "pending", name: "Music", date: "2026-11-02", amount: 20, overdue: true }],
      }}
    />,
  );
  const paid = within(screen.getByRole("region", { name: "budget_paid" }));
  const pending = within(screen.getByRole("region", { name: "budget_pending" }));
  expect(paid.getByText("Cloud Pro")).toBeInTheDocument();
  expect(paid.queryByText("Music")).not.toBeInTheDocument();
  expect(pending.getByText("Music")).toBeInTheDocument();
  expect(pending.getByText(/budget_status_overdue/)).toBeInTheDocument();
  expect(paid.getAllByText("$40")).toHaveLength(2);
  expect(pending.getAllByText("$20")).toHaveLength(2);
});
