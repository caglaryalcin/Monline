import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mocks = vi.hoisted(() => ({
  logoUrl: vi.fn(() => "https://cdn.example.com/logo.png"),
}));

vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { logoUrl: mocks.logoUrl },
}));

vi.mock("@/services/paymentMethods", () => ({
  paymentMethodsService: { iconUrl: vi.fn() },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    formatPrice: (v: number, s: string) => `${v} ${s}`,
    formatDate: () => "Jan 1, 2026",
    daysUntil: () => 10,
    subscriptionProgress: () => 50,
    toMainCurrency: (v: number) => v,
    toMonthly: (v: number) => v,
  };
});

import type { Subscription } from "@/types";

import { SubscriptionsGrid } from "./SubscriptionsGrid";

function getSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    price: 15,
    currency: "usd",
    frequency: 1,
    cycle: "monthly",
    next_payment: "2026-04-01",
    auto_renew: true,
    start_date: "2026-01-01",
    notify: true,
    notify_days_before: 3,
    inactive: false,
    user: "user-1",
    ...overrides,
  };
}

const baseHandlers = {
  onEdit: vi.fn(),
  onClone: vi.fn(),
  onRenew: vi.fn(),
  onHistory: vi.fn(),
  onDelete: vi.fn(),
};

describe("SubscriptionsGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders skeleton loading placeholders when isLoading is true", () => {
    const { container } = render(
      <SubscriptionsGrid isLoading subscriptions={[]} {...baseHandlers} />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders row-shaped skeletons while loading the list layout", () => {
    const { container } = render(
      <SubscriptionsGrid isLoading layout="list" subscriptions={[]} {...baseHandlers} />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(6);
    expect(skeletons[0]).toHaveClass("rounded-xl");
  });

  it("renders the empty state when subscriptions list is empty and not loading", () => {
    render(<SubscriptionsGrid isLoading={false} subscriptions={[]} {...baseHandlers} />);
    expect(screen.getByText("no_subscriptions")).toBeInTheDocument();
    expect(screen.getByText("no_subscriptions_hint")).toBeInTheDocument();
  });

  it("renders subscription cards when subscriptions are provided", () => {
    render(
      <SubscriptionsGrid
        isLoading={false}
        subscriptions={[getSub(), getSub({ id: "sub-2", name: "Spotify" })]}
        {...baseHandlers}
      />,
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
  });

  it.each(["grid", "list"] as const)(
    "shows saving feedback only for the affected action in %s layout",
    (layout) => {
      const props = {
        isLoading: false,
        layout,
        subscriptions: [getSub(), getSub({ id: "sub-2", name: "Spotify" })],
        onToggleAutomation: vi.fn(),
        onToggleActive: vi.fn(),
        ...baseHandlers,
      };
      const { rerender } = render(
        <SubscriptionsGrid
          {...props}
          automationPending
          automationPendingId="sub-1"
          automationPendingSetting="auto_renew"
        />,
      );
      const renewalSettings = screen.getAllByRole("button", { name: "auto_renew" });
      expect(renewalSettings[0]).toHaveAttribute("aria-busy", "true");
      expect(renewalSettings[1]).toHaveAttribute("aria-busy", "false");
      expect(renewalSettings[1]).toBeDisabled();
      expect(renewalSettings[1]).toHaveClass("disabled:opacity-100");
      for (const button of screen.getAllByRole("button", { name: "auto_mark_paid" })) {
        expect(button).toHaveAttribute("aria-busy", "false");
        expect(button).toHaveClass("disabled:opacity-100");
      }
      for (const toggle of screen.getAllByRole("switch")) {
        expect(toggle).toHaveClass("disabled:opacity-100");
      }

      rerender(<SubscriptionsGrid {...props} renewPending renewPendingId="sub-2" />);
      const renewals = screen.getAllByRole("button", { name: "renew" });
      expect(renewals[0]).toHaveAttribute("aria-busy", "false");
      expect(renewals[0]).toBeDisabled();
      expect(renewals[0]).toHaveClass("disabled:opacity-100");
      expect(renewals[1]).toHaveAttribute("aria-busy", "true");
      expect(renewals[1]).toBeDisabled();
    },
  );

  it("keeps price display choices independent and preserves them across layouts and filtering", async () => {
    const user = userEvent.setup();
    const subscriptions = [getSub(), getSub({ id: "sub-2", name: "Spotify" })];
    const { rerender } = render(
      <SubscriptionsGrid isLoading={false} subscriptions={subscriptions} {...baseHandlers} />,
    );
    await user.click(screen.getAllByRole("button", { name: "show_yearly" })[0]);
    expect(screen.getAllByRole("button", { name: "show_monthly" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "show_yearly" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "show_yearly" }));
    rerender(
      <SubscriptionsGrid
        isLoading={false}
        subscriptions={subscriptions}
        layout="list"
        {...baseHandlers}
      />,
    );
    expect(screen.getAllByRole("button", { name: "show_monthly" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "show_monthly" })[0]);
    expect(screen.getAllByRole("button", { name: "show_yearly" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "show_monthly" })).toHaveLength(1);
    rerender(
      <SubscriptionsGrid isLoading={false} subscriptions={[subscriptions[1]]} {...baseHandlers} />,
    );
    expect(screen.getByRole("button", { name: "show_monthly" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "show_yearly" })).not.toBeInTheDocument();
  });

  it("renders subscriptions in the compact list layout", () => {
    const { container } = render(
      <SubscriptionsGrid
        isLoading={false}
        subscriptions={[
          getSub({
            expand: {
              category: {
                id: "cat-1",
                name: "Streaming",
                user: "user-1",
              },
            },
          }),
        ]}
        layout="list"
        {...baseHandlers}
      />,
    );

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("space-y-2");
    expect(screen.getByTitle("edit")).toBeVisible();
  });

  it("calls onEdit, onClone, onRenew, and onDelete with correct subscription when cards trigger actions", () => {
    const sub = getSub();
    render(<SubscriptionsGrid isLoading={false} subscriptions={[sub]} {...baseHandlers} />);

    fireEvent.click(screen.getByTitle("edit"));
    expect(baseHandlers.onEdit).toHaveBeenCalledWith(sub);

    fireEvent.click(screen.getByTitle("clone"));
    expect(baseHandlers.onClone).toHaveBeenCalledWith(sub.id);

    fireEvent.click(screen.getByRole("button", { name: "renew" }));
    expect(baseHandlers.onRenew).toHaveBeenCalledWith(sub.id);

    fireEvent.click(screen.getByTitle("history"));
    expect(baseHandlers.onHistory).toHaveBeenCalledWith(sub);

    fireEvent.click(screen.getByTitle("delete"));
    expect(baseHandlers.onDelete).toHaveBeenCalledWith(sub.id);
  });
});
