import { fireEvent, render, screen } from "@testing-library/react";

import type * as Utils from "@/lib/utils";
import type { Currency, PaymentMethod, Subscription } from "@/types";

const mocks = vi.hoisted(() => ({
  paymentIconUrl: vi.fn(),
  subscriptionLogoUrl: vi.fn(),
  formatPrice: vi.fn((price: number, symbol: string) => `${price.toFixed(2)} ${symbol}`),
  formatDate: vi.fn(() => "Apr 10, 2026"),
  daysUntil: vi.fn((_date: string) => 3),
  subscriptionProgress: vi.fn((_start: string, _next: string) => 75),
  toMainCurrency: vi.fn((price: number, _currency?: Currency) => price * 2),
  toMonthly: vi.fn((price: number) => price / 2),
  windowOpen: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/services/paymentMethods", () => ({
  paymentMethodsService: {
    iconUrl: mocks.paymentIconUrl,
  },
}));

vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: {
    logoUrl: mocks.subscriptionLogoUrl,
  },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof Utils>();
  return {
    ...actual,
    formatPrice: mocks.formatPrice,
    formatDate: mocks.formatDate,
    daysUntil: mocks.daysUntil,
    subscriptionProgress: mocks.subscriptionProgress,
    toMainCurrency: mocks.toMainCurrency,
    toMonthly: mocks.toMonthly,
  };
});

import { SubscriptionCard } from "./SubscriptionCard";

function getCurrency(overrides: Partial<Currency> = {}): Currency {
  return {
    id: "cur-1",
    name: "US Dollar",
    code: "USD",
    symbol: "$",
    rate: 1,
    is_main: false,
    user: "user-1",
    ...overrides,
  };
}

function getPaymentMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: "pm-1",
    name: "Visa",
    user: "user-1",
    ...overrides,
  };
}

function getSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    logo: "netflix.png",
    price: 20,
    currency: "cur-2",
    frequency: 1,
    cycle: "monthly",
    next_payment: "2026-04-10",
    url: "https://example.com/netflix",
    auto_renew: true,
    start_date: "2026-01-01",
    notify: true,
    notify_days_before: 3,
    inactive: false,
    user: "user-1",
    expand: {
      currency: getCurrency({ id: "cur-2", symbol: "R$", rate: 5 }),
      cycle: { id: "monthly", name: "Monthly" },
      category: { id: "cat-1", name: "Streaming", user: "user-1" },
      payer: { id: "payer-1", name: "Daniel", user: "user-1" },
      payment_method: getPaymentMethod({ icon: "visa.png" }),
    },
    ...overrides,
  };
}

describe("SubscriptionCard", () => {
  it.each(["grid", "list"] as const)(
    "hides the payment method for inactive subscriptions in %s layout",
    (layout) => {
      const actions = {
        onEdit: vi.fn(),
        onClone: vi.fn(),
        onRenew: vi.fn(),
        onHistory: vi.fn(),
        onDelete: vi.fn(),
      };
      const sub = getSubscription();
      const { rerender } = render(<SubscriptionCard sub={sub} layout={layout} {...actions} />);
      expect(screen.getByAltText("Visa")).toBeInTheDocument();
      rerender(<SubscriptionCard sub={{ ...sub, inactive: true }} layout={layout} {...actions} />);
      expect(screen.queryByAltText("Visa")).not.toBeInTheDocument();
      expect(screen.queryByText("Visa")).not.toBeInTheDocument();
      rerender(<SubscriptionCard sub={sub} layout={layout} {...actions} />);
      expect(screen.getByAltText("Visa")).toBeInTheDocument();
    },
  );
  it("bases progress on the current billing period regardless of the subscription's age", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    const actual = await vi.importActual<typeof Utils>("@/lib/utils");
    mocks.subscriptionProgress.mockImplementation(actual.subscriptionProgress);
    mocks.daysUntil.mockImplementation(actual.daysUntil);
    const handlers = {
      onEdit: vi.fn(),
      onClone: vi.fn(),
      onRenew: vi.fn(),
      onHistory: vi.fn(),
      onDelete: vi.fn(),
    };
    const sub = getSubscription({ start_date: "2020-01-01", next_payment: "2026-11-06" });
    const { rerender } = render(<SubscriptionCard sub={sub} showProgress {...handlers} />);
    const progress = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(progress).toBeGreaterThan(35);
    expect(progress).toBeLessThan(45);
    expect(mocks.subscriptionProgress).toHaveBeenCalledWith("2026-10-06", "2026-11-06");
    rerender(
      <SubscriptionCard sub={{ ...sub, start_date: "2026-10-06" }} showProgress {...handlers} />,
    );
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBe(progress);
  });
  it("shows the selected bank logo alongside the payer", () => {
    const sub = getSubscription();
    render(
      <SubscriptionCard
        sub={{
          ...sub,
          expand: {
            ...sub.expand,
            payment_method: getPaymentMethod({ name: "Enpara", icon: undefined }),
          },
        }}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Enpara")).toHaveAttribute("src", "/assets/logos/banks/enpara.svg");
    expect(screen.getByText("pays Daniel").parentElement?.parentElement).toContainElement(
      screen.getByAltText("Enpara"),
    );
  });
  it("uses current exchange rates instead of the subscription's stale expanded currency", () => {
    mocks.toMainCurrency.mockImplementation((price, currency) =>
      currency ? price / currency.rate : price,
    );
    const usd = getCurrency({ id: "cur-2", code: "USD", symbol: "$", is_main: false, rate: 1 });
    const main = getCurrency({ id: "try", code: "TRY", symbol: "₺", is_main: true, rate: 1 });
    const sub = getSubscription({
      name: "HBO",
      price: 10,
      expand: { currency: usd, cycle: { id: "monthly", name: "Monthly" } },
    });
    const { rerender } = render(
      <SubscriptionCard
        sub={sub}
        mainCurrency={main}
        currencies={[usd, main]}
        convertCurrency
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("10.00 ₺")).toBeInTheDocument();
    rerender(
      <SubscriptionCard
        sub={sub}
        mainCurrency={main}
        currencies={[{ ...usd, rate: 0.02 }, main]}
        convertCurrency
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("500.00 ₺")).toBeInTheDocument();
    expect(screen.queryByText("10.00 ₺")).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.daysUntil.mockReturnValue(3);
    mocks.subscriptionProgress.mockReturnValue(75);
    mocks.toMainCurrency.mockImplementation((price) => price * 2);
    mocks.subscriptionLogoUrl.mockReturnValue("https://cdn.example.com/netflix.png");
    mocks.paymentIconUrl.mockReturnValue("https://cdn.example.com/visa.png");
    vi.stubGlobal("open", mocks.windowOpen);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders converted monthly pricing, progress, payment details, and action buttons", () => {
    const onEdit = vi.fn();
    const onClone = vi.fn();
    const onRenew = vi.fn();
    const onHistory = vi.fn();
    const onDelete = vi.fn();

    render(
      <SubscriptionCard
        sub={getSubscription()}
        mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
        convertCurrency
        priceDisplay="monthly"
        showProgress
        onEdit={onEdit}
        onClone={onClone}
        onRenew={onRenew}
        onHistory={onHistory}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("20.00 $")).toBeInTheDocument();
    expect(screen.getByText("monthly")).toBeInTheDocument();
    expect(screen.getByText("next_payment")).toBeInTheDocument();
    expect(screen.queryByText("next")).not.toBeInTheDocument();
    expect(screen.getByText("Apr 10, 2026")).toBeInTheDocument();
    expect(screen.queryByText("3 days_short")).not.toBeInTheDocument();
    expect(screen.getByText("billing_days_remaining")).toBeInTheDocument();
    expect(screen.getByText("billing_cycle")).toBeInTheDocument();
    expect(screen.getByText("pays Daniel")).toBeInTheDocument();
    expect(screen.getByAltText("Netflix")).toHaveAttribute(
      "src",
      "https://cdn.example.com/netflix.png",
    );
    expect(screen.getByAltText("Visa")).toHaveAttribute("src", "https://cdn.example.com/visa.png");

    fireEvent.click(screen.getByTitle("open_url"));
    fireEvent.click(screen.getByTitle("edit"));
    fireEvent.click(screen.getByTitle("clone"));
    fireEvent.click(screen.getByTitle("renew"));
    fireEvent.click(screen.getByTitle("history"));
    fireEvent.click(screen.getByTitle("delete"));

    expect(mocks.windowOpen).toHaveBeenCalledWith("https://example.com/netflix", "_blank");
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClone).toHaveBeenCalledTimes(1);
    expect(onRenew).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows count and date limits for finite subscriptions", () => {
    const { rerender } = render(
      <SubscriptionCard
        sub={getSubscription({ payment_limit: 6, payments_completed: 2 })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("payments_progress")).toBeInTheDocument();

    rerender(
      <SubscriptionCard
        sub={getSubscription({ end_date: "2026-07-10" })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("ends_on")).toBeInTheDocument();

    rerender(
      <SubscriptionCard
        sub={getSubscription({ payment_limit: 6, payments_completed: undefined })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("payments_progress")).toBeInTheDocument();

    rerender(
      <SubscriptionCard
        sub={getSubscription({ end_date: "2026-07-10", inactive: true })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("ended_on")).toBeInTheDocument();
  });

  it("falls back to payment method initials when payment icon image fails to load", () => {
    mocks.paymentIconUrl.mockReturnValue("https://cdn.example.com/my-card.png");
    render(
      <SubscriptionCard
        sub={getSubscription({
          expand: {
            currency: getCurrency({ id: "cur-2", symbol: "R$", rate: 5 }),
            cycle: { id: "monthly", name: "Monthly" },
            payment_method: getPaymentMethod({ name: "My Card", icon: "card.png" }),
          },
        })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const paymentImg = screen.getByAltText("My Card");
    expect(paymentImg).toBeInTheDocument();

    // Simulate load error to trigger the initials fallback
    fireEvent.error(paymentImg);

    expect(screen.queryByAltText("My Card")).not.toBeInTheDocument();
    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("keeps the overdue information in the billing progress", () => {
    mocks.daysUntil.mockReturnValue(-5);

    render(
      <SubscriptionCard
        sub={getSubscription()}
        showProgress
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "billing_days_overdue",
    );
  });

  it("uses sub.price directly when the billing period display is selected", () => {
    // priceDisplay="billing" → rawPrice = sub.price (not toMonthly)
    render(
      <SubscriptionCard
        sub={getSubscription({ price: 99 })}
        mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
        convertCurrency={false}
        priceDisplay="billing"
        showProgress={false}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // toMonthly should NOT have been called
    expect(mocks.toMonthly).not.toHaveBeenCalled();
    // formatPrice called with raw price 99
    expect(mocks.formatPrice).toHaveBeenCalledWith(99, expect.any(String), {
      currencyCode: "USD",
    });
  });

  it("keeps one-time credits visible and distinct without recurring actions", () => {
    const onRenew = vi.fn();
    render(
      <SubscriptionCard
        sub={getSubscription({
          name: "Bonus",
          record_type: "credit",
          price: 500,
          cycle: "one-time",
          payment_limit: 12,
          payments_completed: 3,
          end_date: "2026-12-31",
          expand: {
            currency: getCurrency({ id: "cur-2", symbol: "$", is_main: true }),
            cycle: { id: "one-time", name: "One-Time" },
          },
        })}
        priceDisplay="monthly"
        showProgress
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={onRenew}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Bonus")).toBeInTheDocument();
    expect(screen.getByText("credit_income")).toBeInTheDocument();
    expect(screen.getByText("+500.00 $")).toBeInTheDocument();
    expect(screen.getByText("one_time")).toBeInTheDocument();
    expect(screen.getByText("received_on")).toBeInTheDocument();
    expect(screen.queryByText("billing_cycle")).not.toBeInTheDocument();
    expect(screen.queryByText("payments_progress")).not.toBeInTheDocument();
    expect(screen.queryByText("ends_on")).not.toBeInTheDocument();
    expect(screen.queryByTitle("renew")).not.toBeInTheDocument();
    expect(mocks.toMonthly).not.toHaveBeenCalled();
  });

  it("uses rawPrice directly when shouldConvert is false (line 102 false branch)", () => {
    // convertCurrency=false → shouldConvert=false → price = rawPrice
    render(
      <SubscriptionCard
        sub={getSubscription({ price: 50 })}
        mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
        convertCurrency={false}
        priceDisplay="billing"
        showProgress={false}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // toMainCurrency should NOT have been called
    expect(mocks.toMainCurrency).not.toHaveBeenCalled();
  });

  it("shows remaining days only in the billing progress", () => {
    mocks.daysUntil.mockReturnValue(10);
    mocks.subscriptionProgress.mockReturnValue(50);

    render(
      <SubscriptionCard
        sub={getSubscription()}
        mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
        convertCurrency={false}
        priceDisplay="billing"
        showProgress
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText("10 days_short")).not.toBeInTheDocument();
    expect(screen.getByText("billing_days_remaining")).not.toHaveClass("text-orange-500");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "billing_days_remaining",
    );
  });

  it("uses PAYMENT_ICON_MAP src when payment method has no icon but name is in map", () => {
    render(
      <SubscriptionCard
        sub={getSubscription({
          expand: {
            currency: getCurrency({ id: "cur-2", symbol: "R$", rate: 5 }),
            cycle: { id: "monthly", name: "Monthly" },
            payment_method: getPaymentMethod({ name: "Visa", icon: undefined }),
          },
        })}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Visa")).toHaveAttribute("src", "/assets/payments/Visa.png");
  });

  it("defaults frequency to 1 and symbol to $ when frequency is absent and currency has no symbol", () => {
    render(
      <SubscriptionCard
        sub={getSubscription({ frequency: undefined, expand: {} })}
        priceDisplay="monthly"
        convertCurrency={false}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(mocks.toMonthly).toHaveBeenCalledWith(20, "Monthly", 1);
    expect(mocks.formatPrice).toHaveBeenCalledWith(expect.any(Number), "$", {
      currencyCode: undefined,
    });
  });

  it("falls back to $ symbol when mainCurrency has no symbol and shouldConvert is true", () => {
    render(
      <SubscriptionCard
        sub={getSubscription()}
        mainCurrency={getCurrency({ is_main: true, symbol: undefined as unknown as string })}
        convertCurrency
        priceDisplay="billing"
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(mocks.formatPrice).toHaveBeenCalledWith(expect.any(Number), "$", {
      currencyCode: "USD",
    });
  });

  it("falls back to the website icon when the saved image URL is unavailable", () => {
    mocks.subscriptionLogoUrl.mockReturnValue(null);
    render(
      <SubscriptionCard
        sub={getSubscription()}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByAltText("Netflix")).toHaveAttribute(
      "src",
      "https://icon.horse/icon/example.com",
    );
  });

  it("renders fallback initials and inactive state when data is limited", () => {
    render(
      <SubscriptionCard
        sub={getSubscription({
          logo: undefined,
          inactive: true,
          url: undefined,
          expand: {
            currency: getCurrency({ id: "cur-2", symbol: "R$", rate: 5 }),
            cycle: { id: "yearly", name: "Yearly" },
            payment_method: getPaymentMethod({ name: "Unknown Method", icon: undefined }),
          },
        })}
        mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
        convertCurrency={false}
        priceDisplay="billing"
        showProgress={false}
        onEdit={vi.fn()}
        onClone={vi.fn()}
        onRenew={vi.fn()}
        onHistory={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("inactive_label")).toBeInTheDocument();
    expect(screen.getByText("billing_preset_yearly")).toBeInTheDocument();
    expect(screen.getByAltText("Netflix")).toHaveAttribute(
      "src",
      "https://icon.horse/icon/netflix.com",
    );
    expect(screen.queryByText("UM")).not.toBeInTheDocument();
    expect(screen.queryByText("billing_cycle")).not.toBeInTheDocument();
    expect(screen.queryByTitle("open_url")).not.toBeInTheDocument();
  });

  describe("list layout", () => {
    const actions = {
      onEdit: vi.fn(),
      onClone: vi.fn(),
      onRenew: vi.fn(),
      onHistory: vi.fn(),
      onDelete: vi.fn(),
    };

    it("renders a recurring expense row with logo, schedule, payer, and payment method", () => {
      render(
        <SubscriptionCard
          sub={getSubscription()}
          layout="list"
          mainCurrency={getCurrency({ is_main: true, symbol: "$" })}
          convertCurrency
          priceDisplay="monthly"
          showProgress={false}
          {...actions}
        />,
      );

      expect(screen.getByAltText("Netflix")).toHaveAttribute(
        "src",
        "https://cdn.example.com/netflix.png",
      );
      expect(screen.getByText("Streaming")).toBeInTheDocument();
      // toMonthly halves 20 → 10, then conversion doubles it → 20.
      expect(screen.getByText("20.00 $")).toBeInTheDocument();
      expect(screen.getByText("monthly")).toBeInTheDocument();
      expect(screen.getByText("next_payment")).toBeInTheDocument();
      expect(screen.getByText("Apr 10, 2026")).toBeInTheDocument();
      expect(screen.getByText("Daniel")).toBeInTheDocument();
      expect(screen.queryByText("inactive_label")).not.toBeInTheDocument();
      expect(screen.queryByText("credit_income")).not.toBeInTheDocument();
    });

    it("shows the billing period when monthly normalization is off", () => {
      render(
        <SubscriptionCard
          sub={getSubscription({
            frequency: 3,
            expand: {
              currency: getCurrency({ id: "cur-2", symbol: "R$" }),
              cycle: { id: "yearly", name: "Yearly" },
            },
          })}
          layout="list"
          priceDisplay="billing"
          showProgress={false}
          {...actions}
        />,
      );

      expect(screen.getByText("billing_preset_triennial")).toBeInTheDocument();
      // Without category, payer, or payment method the row uses its fallbacks.
      expect(screen.getByText("category")).toBeInTheDocument();
      expect(screen.queryByText("Daniel")).not.toBeInTheDocument();
    });

    it("renders an inactive credit row without a logo or upcoming date", () => {
      mocks.subscriptionLogoUrl.mockReturnValue(null);
      const { rerender } = render(
        <SubscriptionCard
          sub={getSubscription({
            name: "Bonus",
            record_type: "credit",
            inactive: true,
            logo: undefined,
            url: undefined,
            expand: {
              currency: getCurrency({ id: "cur-2", symbol: "$", is_main: true }),
              cycle: { id: "one-time", name: "One-Time" },
            },
          })}
          layout="list"
          priceDisplay="monthly"
          showProgress={false}
          {...actions}
        />,
      );

      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.getByText("credit_income")).toBeInTheDocument();
      expect(screen.getByText("inactive_label")).toBeInTheDocument();
      expect(screen.getByText("+20.00 $")).toBeInTheDocument();
      expect(screen.getByText("one_time")).toBeInTheDocument();
      expect(screen.queryByText("received_on")).not.toBeInTheDocument();

      // A custom record without a website or image keeps a visible initial.
      rerender(
        <SubscriptionCard
          sub={getSubscription({
            name: "Bonus",
            record_type: "credit",
            url: undefined,
            expand: {
              currency: getCurrency({ id: "cur-2", symbol: "$", is_main: true }),
              cycle: { id: "one-time", name: "One-Time" },
            },
          })}
          layout="list"
          priceDisplay="monthly"
          showProgress={false}
          {...actions}
        />,
      );

      expect(screen.getByText("received_on")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });
});
