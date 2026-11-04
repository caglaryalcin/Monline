import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import type { SubscriptionPriceDisplay } from "@/components/subscriptions/subscriptionsPage.types";
import { formatPrice } from "@/lib/utils";
import type { Currency, Subscription } from "@/types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/components/PaymentMethodIcon", () => ({ PaymentMethodIcon: () => null }));
const currency: Currency = {
  id: "eur",
  name: "Euro",
  code: "EUR",
  symbol: "€",
  rate: 1,
  is_main: true,
  user: "owner",
};
const base: Subscription = {
  id: "sub",
  name: "Example",
  price: 600,
  currency: currency.id,
  frequency: 1,
  cycle: "quarterly",
  next_payment: "2027-01-15",
  start_date: "2026-01-15",
  auto_renew: true,
  inactive: false,
  notify: false,
  notify_days_before: 0,
  user: "owner",
  expand: { currency, cycle: { id: "quarterly", name: "Quarterly" } },
};
const actions = {
  onEdit: vi.fn(),
  onClone: vi.fn(),
  onRenew: vi.fn(),
  onHistory: vi.fn(),
  onDelete: vi.fn(),
};

for (const layout of ["grid", "list"] as const) {
  describe(`${layout} price display cycle`, () => {
    it.each([
      ["Daily", 1, 10, 304.4, 3652.8],
      ["Weekly", 1, 120, 520, 6240],
      ["Weekly", 2, 120, 260, 3120],
      ["Monthly", 2, 600, 300, 3600],
      ["Quarterly", 1, 600, 200, 2400],
      ["Half-Yearly", 1, 600, 100, 1200],
      ["Yearly", 2, 600, 25, 300],
    ] as const)(
      "returns %s × %i to the saved billing period without reloading",
      async (cycle, frequency, price, monthly, yearly) => {
        const sub = {
          ...base,
          price,
          frequency,
          expand: { currency, cycle: { id: cycle, name: cycle } },
        };
        const snapshot = JSON.stringify(sub);
        const changed = vi.fn();
        function ControlledCard() {
          const [mode, setMode] = useState<SubscriptionPriceDisplay>("billing");
          return (
            <SubscriptionCard
              sub={sub}
              layout={layout}
              priceDisplay={mode}
              onPriceDisplayChange={(next) => {
                changed(next);
                setMode(next);
              }}
              {...actions}
            />
          );
        }
        render(<ControlledCard />);
        const user = userEvent.setup();
        const toggle = screen.getByRole("button", { name: "show_monthly" });
        for (let repeat = 0; repeat < 2; repeat++) {
          await user.click(toggle);
          expect(
            screen.getByText(formatPrice(monthly, "€", { currencyCode: "EUR" })),
          ).toBeInTheDocument();
          expect(toggle).toHaveAccessibleName("show_yearly");
          await user.click(toggle);
          expect(
            screen.getByText(formatPrice(yearly, "€", { currencyCode: "EUR" })),
          ).toBeInTheDocument();
          expect(toggle).toHaveAccessibleName("show_billing_period");
          await user.click(toggle);
          expect(
            screen.getByText(formatPrice(price, "€", { currencyCode: "EUR" })),
          ).toBeInTheDocument();
          expect(toggle).toHaveAccessibleName("show_monthly");
        }
        expect(changed.mock.calls.map(([mode]) => mode)).toEqual([
          "monthly",
          "yearly",
          "billing",
          "monthly",
          "yearly",
          "billing",
        ]);
        expect(JSON.stringify(sub)).toBe(snapshot);
      },
    );

    it.each([
      ["Monthly", "show_yearly", "show_monthly", "yearly"],
      ["Yearly", "show_monthly", "show_yearly", "monthly"],
    ] as const)(
      "keeps the two-state toggle for %s subscriptions",
      async (cycle, firstLabel, secondLabel, otherMode) => {
        const changed = vi.fn();
        function ControlledCard() {
          const [mode, setMode] = useState<SubscriptionPriceDisplay>("billing");
          return (
            <SubscriptionCard
              sub={{ ...base, expand: { currency, cycle: { id: cycle, name: cycle } } }}
              layout={layout}
              priceDisplay={mode}
              onPriceDisplayChange={(next) => {
                changed(next);
                setMode(next);
              }}
              {...actions}
            />
          );
        }
        render(<ControlledCard />);
        const user = userEvent.setup();
        const toggle = screen.getByRole("button", { name: firstLabel });
        await user.click(toggle);
        expect(toggle).toHaveAccessibleName(secondLabel);
        await user.click(toggle);
        expect(toggle).toHaveAccessibleName(firstLabel);
        expect(changed.mock.calls.map(([mode]) => mode)).toEqual([otherMode, "billing"]);
      },
    );

    it("does not offer a recurring-price toggle for one-time payments", () => {
      render(
        <SubscriptionCard
          sub={{ ...base, expand: { currency, cycle: { id: "once", name: "One-Time" } } }}
          layout={layout}
          {...actions}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /show_monthly|show_yearly|show_billing_period/ }),
      ).not.toBeInTheDocument();
    });
  });
}
