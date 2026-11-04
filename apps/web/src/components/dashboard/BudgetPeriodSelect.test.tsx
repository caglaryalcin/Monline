import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { BudgetOverviewCard } from "@/components/dashboard/BudgetOverviewCard";
import { type BudgetPeriod, buildBudgetPeriod } from "@/lib/budgetPeriod";
import type { Currency, PaymentRecord, Subscription } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en", resolvedLanguage: "en" } }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span>logo</span> }));
vi.mock("@/hooks/useLocalToday", () => ({ useLocalToday: () => "2026-11-04" }));

const currency: Currency = { id: "try", user: "owner", name: "Lira", code: "TRY", symbol: "₺", rate: 1, is_main: true };
const active: Subscription = {
  id: "hbo", user: "owner", name: "HBO", price: 100, currency: currency.id,
  cycle: "monthly", frequency: 3, next_payment: "2026-12-04", start_date: "2026-09-04",
  auto_renew: true, inactive: false, notify: false, notify_days_before: 3,
  expand: { currency, cycle: { id: "monthly", name: "Monthly" } },
};
const disabled = { ...active, id: "disabled", name: "Disabled plan", inactive: true };
const records: PaymentRecord[] = [{ id: "archive", subscription_id: "disabled", user: "owner", due_date: "2026-11-02", paid_at: "2026-11-02T12:00:00Z", amount: 900 }];

function Harness() {
  const [period, setPeriod] = useState<BudgetPeriod>(1);
  const data = buildBudgetPeriod([active, disabled], [currency], records, true, new Date(2026, 10, 4), period);
  return <BudgetOverviewCard budget={1000} entries={data.entries} totalCredits={data.credits}
    periodMonths={period} onPeriodChange={setPeriod} formatValue={(value) => `${value.toFixed(2)} TL`} />;
}

beforeAll(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

it("defaults to monthly and recalculates all dropdown periods using active payments only", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByRole("combobox", { name: "budget_period" })).toHaveTextContent("budget_period_1");
  expect(screen.getByText("budget_this_month")).toBeInTheDocument();
  expect(screen.getByText("budget_month_subscriptions")).toBeInTheDocument();
  expect(screen.getByText("November 2026")).toBeInTheDocument();
  expect(screen.queryByText("HBO")).not.toBeInTheDocument();
  expect(screen.queryByText("Disabled plan")).not.toBeInTheDocument();
  for (const [months, count, total, remaining] of [[3, 1, 100, 2900], [6, 2, 200, 5800], [12, 4, 400, 11600]]) {
    await user.click(screen.getByRole("combobox", { name: "budget_period" }));
    await user.click(screen.getByRole("option", { name: `budget_period_${months}` }));
    expect(screen.getByText(`budget_period_budget_${months}`)).toBeInTheDocument();
    expect(screen.getByText(`budget_period_subscriptions_${months}`)).toBeInTheDocument();
    expect(screen.getByText({3: "November 2026 - January 2027", 6: "November 2026 - April 2027", 12: "November 2026 - October 2027"}[months as 3 | 6 | 12])).toBeInTheDocument();
    expect(screen.getAllByText("HBO")).toHaveLength(count);
    expect(screen.queryByText("Disabled plan")).not.toBeInTheDocument();
    expect(screen.getByText(`${(1000 * months).toFixed(2)} TL`, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("budget_pending").parentElement).toHaveTextContent(`${total.toFixed(2)} TL`);
    expect(screen.getByText(new RegExp(`budget_month_remaining: ${remaining}\\.00 TL`))).toBeInTheDocument();
  }
  await user.click(screen.getByRole("combobox", { name: "budget_period" }));
  await user.click(screen.getByRole("option", { name: "budget_period_1" }));
  expect(screen.queryByText("HBO")).not.toBeInTheDocument();
  expect(screen.getByText(/budget_month_remaining: 1000\.00 TL/)).toBeInTheDocument();
});
