import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import type { ReviewTransaction } from "@/lib/statements";
import { categoriesService } from "@/services/categories";
import { subscriptionsService } from "@/services/subscriptions";
import { createQueryClientWrapper } from "@/test/query-client";
import type { Subscription } from "@/types";

import { StatementImportDialog } from "./StatementImportDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: {
    list: vi.fn(),
    logoUrl: ({ id, logo }: { id: string; logo: string }) => `/saved/${id}/${logo}`,
  },
}));
vi.mock("@/services/currencies", () => ({
  currenciesService: { list: async () => [{ id: "try", code: "TRY" }] },
}));
vi.mock("@/services/cycles", () => ({
  cyclesService: { list: async () => [{ id: "monthly", name: "Monthly" }] },
}));
vi.mock("@/services/categories", () => ({
  categoriesService: {
    create: vi.fn(),
    list: async () => [
      { id: "cat-streaming", name: "Streaming" },
      { id: "cat-ai", name: "AI" },
    ],
  },
}));
vi.mock("@/services/paymentMethods", () => ({
  paymentMethodsService: {
    listForForm: async () => [
      { id: "card-main", name: "Visa", is_main: true },
      { id: "card-other", name: "Mastercard" },
    ],
  },
}));

const row: ReviewTransaction = {
  id: "row-1",
  date: "2026-01-22",
  merchant: "NETFLIX.COM",
  amount: 289.99,
  currency: "TRY",
  kind: "charge",
  page: 1,
  installment: "",
  source: "NETFLIX.COM",
  included: true,
  uncertain: false,
  subscription_service: "Netflix",
  subscription_match: "catalog",
};

function openImport(subscriptions: Subscription[], rows = [row]) {
  vi.mocked(subscriptionsService.list).mockResolvedValue(subscriptions);
  const { Wrapper } = createQueryClientWrapper();
  render(
    <StatementImportDialog
      statementId="statement-1"
      userId="user-1"
      rows={rows}
      onClose={vi.fn()}
      onImported={vi.fn()}
    />,
    { wrapper: Wrapper },
  );
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 19, 12));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("statement import logos", () => {
  it("creates a category inline, selects it only for the current group and makes it available to other groups", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesService.create).mockResolvedValue({
      id: "cat-cloud",
      name: "Cloud services",
      user: "user-1",
    });
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 0, payments_imported: 2, payments_skipped: 0 });
    openImport(
      [
        { id: "netflix", name: "Netflix", currency: "try", category: "" } as Subscription,
        { id: "chatgpt", name: "Chatgpt", currency: "try", category: "cat-ai" } as Subscription,
      ],
      [row, { ...row, id: "row-2", subscription_service: "Chatgpt" }],
    );
    const heading = await screen.findByRole("heading", { name: "Netflix" });
    const group = within(heading.closest("section")!);
    await user.click(group.getByRole("button", { name: "statement_import_add_category" }));
    const input = group.getByRole("textbox", { name: "statement_import_category_name" });
    expect(group.getByRole("button", { name: "add" })).toBeDisabled();
    await user.type(input, "  Cloud services  ");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(group.getByRole("combobox", { name: "category" })).toHaveTextContent("Cloud services"),
    );
    expect(categoriesService.create).toHaveBeenCalledExactlyOnceWith("user-1", "Cloud services");
    expect(group.getByRole("combobox", { name: "category" })).toHaveFocus();
    const otherGroup = within(screen.getByRole("heading", { name: "Chatgpt" }).closest("section")!);
    const otherCategory = otherGroup.getByRole("combobox", { name: "category" });
    expect(otherCategory).toHaveTextContent("AI");
    await user.click(otherCategory);
    expect(screen.getByRole("option", { name: "Cloud services" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        groups: [
          expect.objectContaining({ subscription_id: "netflix", category: "cat-cloud" }),
          expect.objectContaining({ subscription_id: "chatgpt", category: "cat-ai" }),
        ],
      }),
    );
  });

  it("keeps a failed category draft for retry and can cancel without changing the selection", async () => {
    const user = userEvent.setup();
    vi.mocked(categoriesService.create).mockRejectedValueOnce(new Error("Network error"));
    openImport([]);
    await user.click(await screen.findByRole("button", { name: "statement_import_add_category" }));
    const input = screen.getByRole("textbox", { name: "statement_import_category_name" });
    await user.type(input, "Cloud services");
    await user.click(screen.getByRole("button", { name: "add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("failed_add_category");
    expect(input).toHaveValue("Cloud services");
    expect(screen.getByRole("button", { name: "statement_import_submit" })).toBeDisabled();
    vi.mocked(categoriesService.create).mockResolvedValueOnce({
      id: "cat-cloud",
      name: "Cloud services",
      user: "user-1",
    });
    await user.click(screen.getByRole("button", { name: "add" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "category" })).toHaveTextContent(
        "Cloud services",
      ),
    );
    await user.click(screen.getByRole("button", { name: "statement_import_add_category" }));
    await user.type(
      screen.getByRole("textbox", { name: "statement_import_category_name" }),
      "Discarded",
    );
    const categoryForm = screen
      .getByRole("textbox", { name: "statement_import_category_name" })
      .closest("form")!;
    await user.click(within(categoryForm).getByRole("button", { name: "cancel" }));
    expect(screen.getByRole("combobox", { name: "category" })).toHaveTextContent("Cloud services");
    expect(categoriesService.create).toHaveBeenCalledTimes(2);
  });

  it("uses an existing category instead of creating the same name again", async () => {
    const user = userEvent.setup();
    openImport([]);
    await user.click(await screen.findByRole("button", { name: "statement_import_add_category" }));
    await user.type(
      screen.getByRole("textbox", { name: "statement_import_category_name" }),
      " streaming ",
    );
    await user.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByRole("combobox", { name: "category" })).toHaveTextContent("Streaming");
    expect(categoriesService.create).not.toHaveBeenCalled();
  });

  it("selects and imports a statement payment older than one year", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 0, payments_imported: 1, payments_skipped: 0 });
    openImport(
      [
        {
          id: "netflix",
          name: "Netflix",
          currency: "try",
          category: "cat-streaming",
        } as Subscription,
      ],
      [{ ...row, date: "2025-07-21" }],
    );
    const checkbox = await screen.findByRole("checkbox", { name: /2025-07-21/ });
    expect(checkbox).toBeEnabled();
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({ transaction_ids: [row.id], subscription_id: "netflix" }),
        ],
      }),
    );
  });

  it.each(["2026-10-20", "2025-02-30"])(
    "keeps an invalid or future payment disabled (%s)",
    async (date) => {
      openImport([], [{ ...row, date }]);
      const checkbox = await screen.findByRole("checkbox", { name: new RegExp(date) });
      expect(checkbox).toBeDisabled();
      expect(checkbox).not.toBeChecked();
      expect(screen.getByText("statement_import_date_range")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "statement_import_submit" })).toBeDisabled();
    },
  );

  it.each([false, true])(
    "requires a category for selected import groups (existing=%s)",
    async (existing) => {
      const user = userEvent.setup();
      const post = vi
        .spyOn(api, "post")
        .mockResolvedValue({ subscriptions_created: 1, payments_imported: 1, payments_skipped: 0 });
      openImport(
        existing
          ? [{ id: "netflix", name: "Netflix", currency: "try", category: "" } as Subscription]
          : [],
      );
      const category = await screen.findByRole("combobox", { name: "category" });
      const submit = screen.getByRole("button", { name: "statement_import_submit" });
      expect(category).toHaveAttribute("aria-invalid", "true");
      expect(category).toHaveAccessibleDescription("category_required");
      expect(submit).toBeDisabled();
      await user.click(submit);
      expect(post).not.toHaveBeenCalled();
      await user.click(category);
      await user.click(screen.getByRole("option", { name: "Streaming" }));
      expect(submit).toBeEnabled();
      await user.click(submit);
      expect(post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          groups: [expect.objectContaining({ category: "cat-streaming" })],
        }),
      );
    },
  );

  it("automatically uses an existing inactive subscription and shows its saved logo without a selector", async () => {
    openImport([
      {
        id: "netflix",
        name: "Netflix",
        currency: "try",
        inactive: true,
        logo: "custom.png",
        category: "cat-ai",
        payment_method: "card-other",
      } as Subscription,
    ]);
    const heading = await screen.findByRole("heading", { name: "Netflix" });
    expect(
      screen.queryByRole("combobox", { name: "statement_import_target" }),
    ).not.toBeInTheDocument();
    expect(within(heading).getByAltText("Netflix")).toHaveAttribute(
      "src",
      "/saved/netflix/custom.png",
    );
    expect(
      screen.queryByRole("textbox", { name: "statement_subscription" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "category" })).toHaveTextContent("AI");
    expect(screen.getByRole("combobox", { name: "payment_method" })).toHaveTextContent(
      "Mastercard",
    );
  });

  it("uses the main payment method for new subscriptions and submits selected category and method", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 1, payments_imported: 1, payments_skipped: 0 });
    openImport([]);
    const category = await screen.findByRole("combobox", { name: "category" });
    expect(screen.getByRole("combobox", { name: "payment_method" })).toHaveTextContent("Visa");
    await user.click(category);
    await user.click(screen.getByRole("option", { name: "Streaming" }));
    await user.click(screen.getByRole("combobox", { name: "payment_method" }));
    await user.click(screen.getByRole("option", { name: "Mastercard" }));
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({ category: "cat-streaming", payment_method: "card-other" }),
        ],
      }),
    );
  });

  it("lets an existing subscription change category and payment method", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 0, payments_imported: 1, payments_skipped: 0 });
    openImport([
      {
        id: "netflix",
        name: "Netflix",
        currency: "try",
        category: "cat-ai",
        payment_method: "card-other",
      } as Subscription,
    ]);
    await user.click(await screen.findByRole("combobox", { name: "category" }));
    await user.click(screen.getByRole("option", { name: "Streaming" }));
    await user.click(screen.getByRole("combobox", { name: "payment_method" }));
    await user.click(screen.getByRole("option", { name: "Visa" }));
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({
            subscription_id: "netflix",
            category: "cat-streaming",
            payment_method: "card-main",
          }),
        ],
      }),
    );
  });

  it("shows the detected logo for a new subscription and updates it when the name changes", async () => {
    openImport([]);
    const name = await screen.findByRole("textbox", { name: "statement_subscription" });
    expect(within(name.parentElement!).getByAltText("Netflix")).toHaveAttribute(
      "src",
      "https://icon.horse/icon/netflix.com",
    );
    fireEvent.change(name, { target: { value: "Claude" } });
    expect(within(name.parentElement!).getByAltText("Claude")).toHaveAttribute(
      "src",
      "https://icon.horse/icon/claude.ai",
    );
  });

  it("creates an active subscription without adding intermediate payments", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 1, payments_imported: 1, payments_skipped: 0 });
    openImport([]);
    await screen.findByRole("textbox", { name: "statement_subscription" });
    expect(
      screen.queryByRole("combobox", { name: "statement_import_target" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "statement_import_active" }));
    for (const category of screen.getAllByRole("combobox", { name: "category" })) {
      await user.click(category);
      await user.click(screen.getByRole("option", { name: "Streaming" }));
    }
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({ new_subscription: expect.objectContaining({ active: true }) }),
        ],
      }),
    );
    expect(post.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        groups: [expect.not.objectContaining({ historical_payments: expect.anything() })],
      }),
    );
  });

  it("reviews missing paid dates independently of active status and excludes the statement date", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ subscriptions_created: 1, payments_imported: 9, payments_skipped: 0 });
    openImport([]);
    await screen.findByRole("textbox", { name: "statement_subscription" });
    await user.click(screen.getByRole("switch", { name: "statement_import_history" }));
    await user.click(screen.getByRole("combobox", { name: "category" }));
    await user.click(screen.getByRole("option", { name: "Streaming" }));
    const submit = screen.getByRole("button", { name: "statement_import_submit" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveClass("disabled:bg-muted", "disabled:text-muted-foreground");
    expect(submit).toHaveAccessibleDescription("Netflix: backfill_confirm_required");
    const confirmation = screen.getByRole("checkbox", { name: "backfill_confirm" });
    const scroll = vi.fn();
    confirmation.scrollIntoView = scroll;
    await user.click(screen.getByRole("button", { name: "Netflix: backfill_confirm_required" }));
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(confirmation).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "backfill_start_date" })).not.toBeInTheDocument();
    await user.click(confirmation);
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    for (const category of screen.getAllByRole("combobox", { name: "category" })) {
      await user.click(category);
      await user.click(screen.getByRole("option", { name: "Streaming" }));
    }
    await user.click(screen.getByRole("button", { name: "statement_import_submit" }));
    expect(post).toHaveBeenCalledWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({
            new_subscription: expect.objectContaining({ active: false }),
            historical_payments: expect.objectContaining({ confirmed: true }),
          }),
        ],
      }),
    );
    const body = post.mock.calls[0][1] as {
      groups: { historical_payments: { payments: { due_date: string; amount: number }[] } }[];
    };
    expect(body.groups[0].historical_payments.payments.map((payment) => payment.due_date)).toEqual([
      "2026-02-22",
      "2026-03-22",
      "2026-04-22",
      "2026-05-22",
      "2026-06-22",
      "2026-07-22",
      "2026-08-22",
      "2026-09-22",
    ]);
    expect(
      body.groups[0].historical_payments.payments.every((payment) => payment.amount === row.amount),
    ).toBe(true);
  });

  it("identifies each unreviewed history and allows importing without history after switching it off", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(api, "post").mockResolvedValue({
      subscriptions_created: 2,
      payments_imported: 10,
      payments_skipped: 0,
    });
    openImport([], [row, { ...row, id: "row-2", subscription_service: "YouTube Member" }]);
    await screen.findByRole("heading", { name: "YouTube Member" });
    for (const category of screen.getAllByRole("combobox", { name: "category" })) {
      await user.click(category);
      await user.click(screen.getByRole("option", { name: "Streaming" }));
    }
    const switches = screen.getAllByRole("switch", { name: "statement_import_history" });
    await user.click(switches[0]);
    await user.click(switches[1]);
    expect(
      screen.getByRole("button", { name: "Netflix: backfill_confirm_required" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "YouTube Member: backfill_confirm_required" }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("checkbox", { name: "backfill_confirm" })[0]);
    expect(
      screen.queryByRole("button", { name: "Netflix: backfill_confirm_required" }),
    ).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "statement_import_submit" });
    expect(submit).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    await user.click(switches[1]);
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(submit);
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/api/statements/statement-1/import",
      expect.objectContaining({
        groups: [
          expect.objectContaining({
            historical_payments: expect.objectContaining({ confirmed: true }),
          }),
          expect.not.objectContaining({ historical_payments: expect.anything() }),
        ],
      }),
    );
  });
});
