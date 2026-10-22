import { render, screen } from "@testing-library/react";

import { formatPrice } from "@/lib/utils";
import type { Currency, Subscription } from "@/types";

import { SubscriptionCard } from "./SubscriptionCard";
import type { SubscriptionPriceDisplay } from "./subscriptionsPage.types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/components/PaymentMethodIcon", () => ({ PaymentMethodIcon: () => null }));

const euro: Currency = {
  id: "eur",
  name: "Euro",
  code: "EUR",
  symbol: "€",
  rate: 1,
  is_main: true,
  user: "user",
};
const subscription: Subscription = {
  id: "sub",
  name: "Sample",
  price: 120,
  currency: "eur",
  frequency: 1,
  cycle: "yearly",
  next_payment: "2027-01-15",
  start_date: "2026-01-15",
  auto_renew: true,
  inactive: false,
  notify: false,
  notify_days_before: 0,
  user: "user",
  expand: { currency: euro, cycle: { id: "yearly", name: "Yearly" } },
};
const actions = {
  onEdit: vi.fn(),
  onClone: vi.fn(),
  onRenew: vi.fn(),
  onHistory: vi.fn(),
  onDelete: vi.fn(),
};

for (const layout of ["grid", "list"] as const) {
  describe(`subscription pricing in ${layout} layout`, () => {
    it.each([
      ["Monthly", 1, 10, 10, 120, "billing_preset_monthly"],
      ["Yearly", 1, 120, 10, 120, "billing_preset_yearly"],
      ["Yearly", 2, 240, 10, 120, "billing_preset_biennial"],
      ["Quarterly", 1, 30, 10, 120, "billing_preset_quarterly"],
      ["One-Time", 1, 50, 50, 50, "one_time"],
    ] as const)(
      "shows %s × %i with its original price by default",
      (cycle, frequency, price, monthly, yearly, label) => {
        const sub = {
          ...subscription,
          price,
          frequency,
          expand: { ...subscription.expand, cycle: { id: cycle, name: cycle } },
        };
        const { rerender } = render(<SubscriptionCard sub={sub} layout={layout} {...actions} />);
        expect(
          screen.getByText(formatPrice(price, "€", { currencyCode: "EUR" })),
        ).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        for (const [mode, expected] of [
          ["monthly", monthly],
          ["yearly", yearly],
        ] as const) {
          rerender(<SubscriptionCard sub={sub} layout={layout} priceDisplay={mode} {...actions} />);
          expect(
            screen.getByText(formatPrice(expected, "€", { currencyCode: "EUR" })),
          ).toBeInTheDocument();
          expect(screen.getByText(cycle === "One-Time" ? "one_time" : mode)).toBeInTheDocument();
        }
        rerender(
          <SubscriptionCard sub={sub} layout={layout} priceDisplay="billing" {...actions} />,
        );
        expect(
          screen.getByText(formatPrice(price, "€", { currencyCode: "EUR" })),
        ).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(sub.price).toBe(price);
      },
    );

    it.each(["billing", "monthly", "yearly"] as SubscriptionPriceDisplay[])(
      "preserves a one-time credit when displaying %s prices",
      (priceDisplay) => {
        render(
          <SubscriptionCard
            sub={{ ...subscription, record_type: "credit" }}
            layout={layout}
            priceDisplay={priceDisplay}
            {...actions}
          />,
        );
        expect(
          screen.getByText(`+${formatPrice(120, "€", { currencyCode: "EUR" })}`),
        ).toBeInTheDocument();
        expect(screen.getByText("one_time")).toBeInTheDocument();
      },
    );

    it("converts the annual equivalent to the main currency while keeping the billed amount", () => {
      const dollar = { ...euro, id: "usd", code: "USD", symbol: "$", is_main: false, rate: 2 };
      render(
        <SubscriptionCard
          sub={{
            ...subscription,
            price: 20,
            currency: "usd",
            expand: { currency: dollar, cycle: { id: "monthly", name: "Monthly" } },
          }}
          currencies={[euro, dollar]}
          mainCurrency={euro}
          convertCurrency
          layout={layout}
          priceDisplay="yearly"
          {...actions}
        />,
      );
      expect(screen.getByText(formatPrice(120, "€", { currencyCode: "EUR" }))).toBeInTheDocument();
      expect(
        screen.getByText(`${formatPrice(20, "$", { currencyCode: "USD" })} / billing_preset_monthly`),
      ).toBeInTheDocument();
      expect(screen.getByText("yearly")).toBeInTheDocument();
    });
  });
}
