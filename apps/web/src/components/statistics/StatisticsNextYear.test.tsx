import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { StatisticsPaymentsCard } from "@/components/statistics/StatisticsPaymentsCard";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import type { Subscription } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span /> }));

const subscription: Subscription = {
  id: "active", name: "Projected subscription", user: "u", currency: "usd", price: 200,
  frequency: 1, cycle: "monthly", start_date: "2026-01-01", next_payment: "2026-11-05",
  auto_renew: true, inactive: false, notify: false, notify_days_before: 0,
  price_changes: [{ effective_date: "2027-07-01", price: 250 }],
  expand: { cycle: { id: "monthly", name: "Monthly" } },
};

function Payments({ initialYear = 2026 }: { initialYear?: number }) {
  const [year, setYear] = useState(initialYear);
  const currentYear = new Date().getFullYear();
  const data = buildPaymentStatistics([
    subscription,
    { ...subscription, id: "ended", name: "Ended subscription", cancellation_date: "2026-12-31" },
    { ...subscription, id: "disabled", name: "Renewal disabled", auto_renew: false },
  ], [], [{
    id: "paid", user: "u", subscription_id: "active", due_date: "2026-10-05",
    paid_at: "2026-10-05T12:00:00", amount: 150,
  }], new Date(), 12, 12, year);
  return <StatisticsPaymentsCard data={data} year={year} years={[currentYear, currentYear - 1]}
    onYearChange={setYear} formatValue={(value) => `$${value}`} />;
}

describe("next calendar year payment planning", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 12));
  });
  afterEach(() => vi.useRealTimers());

  it("plans next year's scheduled prices, excludes ended renewals and returns to recorded payments", async () => {
    const user = userEvent.setup();
    render(<Payments />);
    const selector = () => screen.getByRole("combobox", { name: "history_select_year" });
    await user.click(selector());
    expect(screen.queryByRole("option", { name: "2027" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "2026" }));
    await user.click(screen.getByRole("button", { name: "payments_upcoming" }));
    await user.click(selector());
    await user.click(screen.getByRole("option", { name: "2027" }));
    const months = within(screen.getByRole("list", { name: "payments_by_month" }));
    expect(months.getAllByRole("button")).toHaveLength(12);
    expect(months.getByRole("button", { name: /Jan 2027/ })).toHaveTextContent("$200");
    expect(months.getByRole("button", { name: /Jul 2027/ })).toHaveTextContent("$250");
    await user.click(months.getByRole("button", { name: /Jan 2027/ }));
    const details = within(screen.getByRole("region", { name: "January 2027" }));
    expect(details.getByText("Projected subscription")).toBeInTheDocument();
    expect(details.queryByText("Ended subscription")).not.toBeInTheDocument();
    expect(details.queryByText("Renewal disabled")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "budget_paid" }));
    expect(selector()).toHaveTextContent("2026");
    expect(within(screen.getByRole("region", { name: "October 2026" })).getByText("$150"))
      .toBeInTheDocument();
  });

  it("advances the next-year option at the year boundary and restores a selected future view", async () => {
    vi.setSystemTime(new Date(2027, 0, 2, 12));
    const user = userEvent.setup();
    render(<Payments initialYear={2028} />);
    expect(screen.getByRole("button", { name: "payments_upcoming" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Jan 2028/ })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "history_select_year" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "2028", "2027", "2026",
    ]);
  });
});
