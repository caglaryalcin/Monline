import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import { monthlyBudgetFixture } from "@/test/fixtures/monthlyBudget";

import { StatisticsPaymentsCard } from "./StatisticsPaymentsCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.month
        ? `${key}: ${values.month} ${values.amount ?? ""}`
        : key === "statistics_last_months" || key === "statistics_next_months"
          ? `${key}:${values?.count}`
          : key,
  }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => <span /> }));

describe("monthly horizontal payment breakdown", () => {
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
  const formatValue = (value: number) => `$${value}`;

  it("shows the subscription, localized category and monthly amount when hovering a colored segment", async () => {
    const subscription = monthlyBudgetFixture().entries[0].subscription;
    render(
      <StatisticsPaymentsCard
        data={{
          paid: [
            {
              name: "2026/10",
              total: 30,
              count: 1,
              unpricedCount: 0,
              subscriptions: [
                {
                  subscription: {
                    ...subscription,
                    expand: {
                      category: { id: "video", name: "Video", translation_key: "video", user: "u" },
                    },
                  },
                  amount: 30,
                  count: 1,
                },
              ],
            },
          ],
          upcoming: [],
        }}
        formatValue={formatValue}
      />,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(
      screen.getByRole("img", { name: "Netflix · category_default_video · $30" }),
    );
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Netflix");
    expect(tooltip).toHaveTextContent("category_default_video");
    expect(tooltip).toHaveTextContent("$30");
  });

  it("selects a calendar year for both paid and upcoming payments without rolling month options", async () => {
    function Payments() {
      const [year, setYear] = useState(2026);
      return (
        <StatisticsPaymentsCard
          data={buildPaymentStatistics([], [], [], new Date(), 12, 12, year)}
          formatValue={formatValue}
          year={year}
          years={[2026, 2025]}
          onYearChange={setYear}
        />
      );
    }
    const user = userEvent.setup();
    render(<Payments />);
    const months = () => within(screen.getByRole("list", { name: "payments_by_month" }));
    expect(months().getAllByRole("button")).toHaveLength(12);
    expect(months().getByRole("button", { name: /Jan 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2026");
    await user.click(screen.getByRole("combobox", { name: "history_select_year" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "2026",
      "2025",
    ]);
    await user.click(screen.getByRole("option", { name: "2025" }));
    expect(months().getAllByRole("button")).toHaveLength(12);
    expect(months().getByRole("button", { name: /Jan 2025/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "payments_upcoming" }));
    expect(months().getAllByRole("button")).toHaveLength(12);
    expect(months().getByRole("button", { name: /Dec 2025/ })).toBeInTheDocument();
    expect(months().queryByRole("button", { name: /Aug 2026/ })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "history_select_year" })).toHaveTextContent("2025");
    expect(screen.queryByText(/statistics_last_months/)).not.toBeInTheDocument();
  });

  it("selects a month to reveal exactly the subscriptions and amounts paid in it", () => {
    const sample = monthlyBudgetFixture().entries;
    const data = buildPaymentStatistics(
      sample.map((entry) => entry.subscription),
      [],
      [
        {
          id: "p1",
          user: "u",
          subscription_id: sample[0].subscription.id,
          due_date: "2026-10-01",
          paid_at: "2026-10-03T12:00:00",
          amount: 30,
        },
        {
          id: "p2",
          user: "u",
          subscription_id: sample[1].subscription.id,
          due_date: "2026-09-01",
          paid_at: "2026-09-03T12:00:00",
          amount: 20,
        },
      ],
    );
    render(<StatisticsPaymentsCard data={data} formatValue={formatValue} />);
    expect(screen.getByRole("button", { name: /Oct 2026/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(screen.getByRole("region", { name: "October 2026" })).getByText("Netflix"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sep 2026/ }));
    const details = screen.getByRole("region", { name: "September 2026" });
    expect(within(details).getByText("Spotify")).toBeInTheDocument();
    expect(within(details).getByText("$20")).toBeInTheDocument();
    expect(within(details).queryByText("Netflix")).not.toBeInTheDocument();
  });

  it("switches between confirmed and upcoming account data", () => {
    render(
      <StatisticsPaymentsCard
        data={buildPaymentStatistics([], [], [])}
        formatValue={formatValue}
      />,
    );
    expect(screen.queryByText(/statistics_last_months/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "subscriptions" })).not.toBeInTheDocument();
    expect(screen.getByText(/payments_month_empty:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "payments_upcoming" }));
    expect(screen.getByText("payments_upcoming_note")).toBeInTheDocument();
  });

  it("reports loading and errors without showing partial totals", () => {
    const data = buildPaymentStatistics([], [], []);
    const { rerender } = render(
      <StatisticsPaymentsCard data={data} isLoading formatValue={formatValue} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    rerender(<StatisticsPaymentsCard data={data} hasError formatValue={formatValue} />);
    expect(screen.getByRole("alert")).toHaveTextContent("payments_load_error");
  });
});
