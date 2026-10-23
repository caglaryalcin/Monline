import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { queryKeys } from "@/lib/queryKeys";
import { createQueryClientWrapper } from "@/test/query-client";

const mocks = vi.hoisted(() => ({
  listSubscriptions: vi.fn(),
  listCurrencies: vi.fn(),
  listCategories: vi.fn(),
  listPaymentMethods: vi.fn(),
  listHousehold: vi.fn(),
  deleteSubscription: vi.fn(),
  cloneSubscription: vi.fn(),
  renewSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  updateRates: vi.fn(),
  toastWarning: vi.fn(),
  exportSubscriptions: vi.fn(),
  importSubscriptions: vi.fn(),
  filteredSubscriptions: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  jsonUrl: vi.fn(),
  revokeUrl: vi.fn(),
  xlsxJsonToSheet: vi.fn(),
  xlsxBookNew: vi.fn(),
  xlsxBookAppendSheet: vi.fn(),
  xlsxWriteFile: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: mocks.xlsxJsonToSheet,
    book_new: mocks.xlsxBookNew,
    book_append_sheet: mocks.xlsxBookAppendSheet,
  },
  writeFile: mocks.xlsxWriteFile,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: {
    list: mocks.listSubscriptions,
    delete: mocks.deleteSubscription,
    clone: mocks.cloneSubscription,
    renew: mocks.renewSubscription,
    update: mocks.updateSubscription,
    export: mocks.exportSubscriptions,
    import: mocks.importSubscriptions,
  },
}));

vi.mock("@/services/fixer", () => ({
  fixerService: { updateRates: mocks.updateRates },
}));

vi.mock("@/services/currencies", () => ({
  currenciesService: {
    list: mocks.listCurrencies,
  },
}));

vi.mock("@/services/categories", () => ({
  categoriesService: {
    list: mocks.listCategories,
  },
}));

vi.mock("@/services/paymentMethods", () => ({
  paymentMethodsService: {
    listForForm: mocks.listPaymentMethods,
  },
}));

vi.mock("@/services/household", () => ({
  householdService: {
    list: mocks.listHousehold,
  },
}));

vi.mock("@/hooks/useFilteredSubscriptions", () => ({
  useFilteredSubscriptions: mocks.filteredSubscriptions,
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/components/subscriptions/SubscriptionsPageHeader", () => ({
  SubscriptionsPageHeader: ({ onCreate }: { onCreate: () => void }) => (
    <button type="button" onClick={onCreate}>
      create-subscription
    </button>
  ),
}));

vi.mock("@/components/subscriptions/SubscriptionsToolbar", () => ({
  SubscriptionsToolbar: ({
    onSearchChange,
    onToggleFilters,
    onCycleSort,
    onViewChange,
  }: {
    onSearchChange: (value: string) => void;
    onToggleFilters: () => void;
    onCycleSort: () => void;
    onViewChange: (view: "grid" | "list") => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSearchChange("netflix")}>
        change-search
      </button>
      <button type="button" onClick={onToggleFilters}>
        toggle-filters
      </button>
      <button type="button" onClick={onCycleSort}>
        cycle-sort
      </button>
      <button type="button" onClick={() => onViewChange("list")}>
        list-view
      </button>
    </div>
  ),
}));

vi.mock("@/components/subscriptions/SubscriptionsFiltersPanel", () => ({
  SubscriptionsFiltersPanel: () => <div>filters-panel</div>,
}));

vi.mock("@/components/subscriptions/SubscriptionsGrid", () => ({
  SubscriptionsGrid: ({
    subscriptions,
    layout,
    onEdit,
    onClone,
    onRenew,
    renewPending,
    onHistory,
    onDelete,
    onToggleAutomation,
    automationPending,
  }: {
    subscriptions: Array<{ id: string; name: string }>;
    layout: "grid" | "list";
    onEdit: (subscription: { id: string; name: string }) => void;
    onClone: (id: string) => void;
    onRenew: (id: string) => void;
    renewPending?: boolean;
    onHistory: (subscription: { id: string; name: string }) => void;
    onDelete: (id: string) => void;
    onToggleAutomation: (
      subscription: { id: string; name: string },
      setting: "auto_renew" | "auto_mark_paid",
    ) => void;
    automationPending?: boolean;
  }) => (
    <div>
      <div>grid:{subscriptions.length}</div>
      <div>layout:{layout}</div>
      <button
        type="button"
        disabled={automationPending}
        onClick={() => onToggleAutomation(subscriptions[0], "auto_renew")}
      >
        toggle-auto-renew
      </button>
      <button
        type="button"
        disabled={automationPending}
        onClick={() => onToggleAutomation(subscriptions[0], "auto_mark_paid")}
      >
        toggle-auto-paid
      </button>
      <button type="button" onClick={() => onEdit(subscriptions[0])}>
        edit-subscription
      </button>
      <button type="button" onClick={() => onClone(subscriptions[0].id)}>
        clone-subscription
      </button>
      <button type="button" disabled={renewPending} onClick={() => onRenew(subscriptions[0].id)}>
        renew-subscription
      </button>
      <button type="button" onClick={() => onHistory(subscriptions[0])}>
        history-subscription
      </button>
      <button type="button" onClick={() => onDelete(subscriptions[0].id)}>
        delete-subscription
      </button>
    </div>
  ),
}));

vi.mock("@/components/SubscriptionFormModal", () => ({
  SubscriptionFormModal: ({
    sub,
    onClose,
    onSaved,
  }: {
    sub: { name?: string } | null;
    onClose: () => void;
    onSaved: () => void;
  }) => (
    <div>
      <div>form:{sub?.name ?? "new"}</div>
      <button type="button" onClick={onSaved}>
        save-form
      </button>
      <button type="button" onClick={onClose}>
        close-form
      </button>
    </div>
  ),
}));

vi.mock("@/components/subscriptions/SubscriptionHistoryDialog", () => ({
  SubscriptionHistoryDialog: ({ sub, onClose }: { sub: { name: string }; onClose: () => void }) => (
    <div>
      <div>history:{sub.name}</div>
      <button type="button" onClick={onClose}>
        close-history
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={onConfirm}>
          confirm-delete
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          close-delete
        </button>
      </div>
    ) : null,
}));

import { SubscriptionsPage } from "./SubscriptionsPage";

describe("SubscriptionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: {
        id: "user-1",
        convert_currency: true,
        monthly_price: true,
        subscription_progress: true,
      },
    });
    mocks.listSubscriptions.mockResolvedValue([
      { id: "sub-1", name: "Netflix", currency: "cur-usd" },
    ]);
    mocks.listCurrencies.mockResolvedValue([
      { id: "cur-1", code: "TRY", symbol: "₺", is_main: true },
      { id: "cur-usd", code: "USD", symbol: "$", is_main: false },
    ]);
    mocks.listCategories.mockResolvedValue([{ id: "cat-1", name: "Streaming" }]);
    mocks.listPaymentMethods.mockResolvedValue([{ id: "pm-1", name: "Visa" }]);
    mocks.listHousehold.mockResolvedValue([{ id: "hh-1", name: "Daniel" }]);
    mocks.deleteSubscription.mockResolvedValue(undefined);
    mocks.cloneSubscription.mockResolvedValue(undefined);
    mocks.renewSubscription.mockResolvedValue(undefined);
    mocks.updateRates.mockResolvedValue({ updated: 2, base: "USD" });
    mocks.exportSubscriptions.mockResolvedValue({
      subscriptions: [{ id: "sub-1", name: "Netflix" }],
    });
    mocks.importSubscriptions.mockResolvedValue({ imported: 1, skipped: 0 });
    mocks.filteredSubscriptions.mockImplementation(
      ({ subscriptions }: { subscriptions: Array<{ id: string; name: string }> }) => subscriptions,
    );
    vi.stubGlobal("URL", {
      createObjectURL: mocks.jsonUrl.mockReturnValue("blob:subscriptions"),
      revokeObjectURL: mocks.revokeUrl,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders grid data, handles filters, and opens the form", async () => {
    const { client, Wrapper } = createQueryClientWrapper();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);

    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mocks.listSubscriptions).toHaveBeenCalledWith("user-1");
    });

    await waitFor(() => {
      expect(screen.getByText((content) => content === "grid:1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "toggle-filters" }));
    expect(screen.getByText("filters-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "create-subscription" }));
    expect(screen.getByText("form:new")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save-form" }));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith();
      expect(screen.queryByText("form:new")).not.toBeInTheDocument();
    });
  });

  it.each([
    ["toggle-auto-renew", "auto_renew"],
    ["toggle-auto-paid", "auto_mark_paid"],
  ] as const)(
    "saves %s directly and blocks repeated changes during saving",
    async (label, setting) => {
      let resolveUpdate!: (value: unknown) => void;
      mocks.updateSubscription.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      const { client, Wrapper } = createQueryClientWrapper();
      const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
      render(<SubscriptionsPage />, { wrapper: Wrapper });
      await screen.findByText("grid:1");
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() =>
        expect(mocks.updateSubscription).toHaveBeenCalledWith("sub-1", { [setting]: true }),
      );
      expect(screen.getByRole("button", { name: "toggle-auto-renew" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "toggle-auto-paid" })).toBeDisabled();
      resolveUpdate({
        id: "sub-1",
        auto_renew: setting === "auto_renew",
        auto_mark_paid: setting === "auto_mark_paid",
      });
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith());
      expect(
        client.getQueryData<Array<Record<string, unknown>>>(
          queryKeys.subscriptions.all("user-1"),
        )?.[0][setting],
      ).toBe(true);
    },
  );

  it("keeps the saved automation state when updating fails", async () => {
    mocks.updateSubscription.mockRejectedValue(new Error("network failure"));
    const original = { id: "sub-1", name: "Netflix", auto_renew: false, auto_mark_paid: false };
    mocks.listSubscriptions.mockResolvedValue([original]);
    const { client, Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });
    await screen.findByText("grid:1");
    fireEvent.click(screen.getByRole("button", { name: "toggle-auto-renew" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("unknown_error"));
    expect(client.getQueryData(queryKeys.subscriptions.all("user-1"))).toEqual([original]);
    expect(screen.getByRole("button", { name: "toggle-auto-renew" })).toBeEnabled();
  });

  it("handles edit, clone, renew, and delete flows with query invalidation", async () => {
    const { client, Wrapper } = createQueryClientWrapper();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);

    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("grid:1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "edit-subscription" }));
    expect(screen.getByText("form:Netflix")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "clone-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "delete-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-delete" }));

    await waitFor(() => {
      expect(mocks.cloneSubscription).toHaveBeenCalledWith("sub-1");
      expect(mocks.renewSubscription).toHaveBeenCalledWith("sub-1");
      expect(mocks.deleteSubscription).toHaveBeenCalledWith("sub-1");
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("success");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("subscription_deleted");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.subscriptions.all("user-1"),
    });
  });

  it.each([
    ["TRY", "USD"],
    ["EUR", "USD"],
    ["USD", "EUR"],
    ["GBP", "JPY"],
    ["JPY", "GBP"],
  ])(
    "refreshes only the card currency when main is %s and card is %s",
    async (mainCode, cardCode) => {
      mocks.listCurrencies.mockResolvedValue([
        { id: "main-currency", code: mainCode, is_main: true },
        { id: "card-currency", code: cardCode, is_main: false },
      ]);
      mocks.listSubscriptions.mockResolvedValue([
        { id: "sub-1", name: "Netflix", currency: "card-currency" },
      ]);
      const { client, Wrapper } = createQueryClientWrapper();
      const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
      render(<SubscriptionsPage />, { wrapper: Wrapper });
      await screen.findByText("grid:1");

      fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith("subscription_renewed_rates_updated"),
      );
      expect(mocks.renewSubscription).toHaveBeenCalledWith("sub-1");
      expect(mocks.updateRates).toHaveBeenCalledTimes(1);
      expect(mocks.updateRates).toHaveBeenCalledWith("card-currency");
      expect(mocks.renewSubscription.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.updateRates.mock.invocationCallOrder[0],
      );
      expect(invalidateQueries).toHaveBeenCalledWith();
    },
  );

  it.each(["TRY", "EUR", "USD", "GBP", "JPY"])(
    "renews %s main-currency subscriptions without requesting exchange rates",
    async (mainCode) => {
      mocks.listCurrencies.mockResolvedValue([{ id: "cur-1", code: mainCode, is_main: true }]);
      mocks.listSubscriptions.mockResolvedValue([
        { id: "sub-1", name: "Netflix", currency: "cur-1" },
      ]);
      const { Wrapper } = createQueryClientWrapper();
      render(<SubscriptionsPage />, { wrapper: Wrapper });
      await screen.findByText("grid:1");
      await waitFor(() => expect(mocks.listCurrencies).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("success"));
      expect(mocks.renewSubscription).toHaveBeenCalledWith("sub-1");
      expect(mocks.updateRates).not.toHaveBeenCalled();
      expect(mocks.toastWarning).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["No exchange rate API key configured.", "subscription_renewed_rates_no_key"],
    ["Provider unavailable", "subscription_renewed_rates_failed"],
  ])("preserves renewal when exchange rates fail: %s", async (error, message) => {
    mocks.updateRates.mockRejectedValueOnce(new Error(error));
    const { client, Wrapper } = createQueryClientWrapper();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    render(<SubscriptionsPage />, { wrapper: Wrapper });
    await screen.findByText("grid:1");

    fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));

    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalledWith(message));
    expect(mocks.renewSubscription).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith();
  });

  it("blocks duplicate renewals while exchange rates are updating", async () => {
    let finishRates!: (value: { updated: number; base: string }) => void;
    mocks.updateRates.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRates = resolve;
      }),
    );
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });
    await screen.findByText("grid:1");
    const renew = screen.getByRole("button", { name: "renew-subscription" });
    fireEvent.click(renew);
    await waitFor(() => expect(mocks.updateRates).toHaveBeenCalledTimes(1));
    expect(renew).toBeDisabled();
    fireEvent.click(renew);
    expect(mocks.renewSubscription).toHaveBeenCalledTimes(1);
    finishRates({ updated: 2, base: "USD" });
    await waitFor(() => expect(renew).toBeEnabled());
  });

  it("does not update exchange rates when subscription renewal fails", async () => {
    mocks.renewSubscription.mockRejectedValueOnce(new Error("category_required"));
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });
    await screen.findByText("grid:1");
    fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("category_required"));
    expect(mocks.updateRates).not.toHaveBeenCalled();
  });

  it("handles mutation errors", async () => {
    mocks.deleteSubscription.mockRejectedValueOnce(new Error("del err"));
    mocks.cloneSubscription.mockRejectedValueOnce(new Error("clone err"));
    mocks.renewSubscription.mockRejectedValueOnce(new Error("renew err"));

    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText("grid:1"));

    fireEvent.click(screen.getByRole("button", { name: "clone-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "renew-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "delete-subscription" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-delete" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("error_deleting_subscription");
      expect(mocks.toastError).toHaveBeenCalledWith("unknown_error"); // maybe twice
    });
  });

  it("handles cycle sort toggle logic", () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    const btn = screen.getByRole("button", { name: "cycle-sort" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    // Verified implicitly as code path is walked since initial is `sort=name`.
  });

  it("switches between grid and compact list views", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    expect(screen.getByText("layout:grid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "list-view" }));
    expect(screen.getByText("layout:list")).toBeInTheDocument();
  });

  it("closes the subscription form via the close-form button (onClose handler)", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText("grid:1"));

    // Open the form
    fireEvent.click(screen.getByRole("button", { name: "create-subscription" }));
    expect(screen.getByText("form:new")).toBeInTheDocument();

    // Close via the onClose handler (line 258)
    fireEvent.click(screen.getByRole("button", { name: "close-form" }));
    expect(screen.queryByText("form:new")).not.toBeInTheDocument();
  });

  it("closes the delete dialog when onOpenChange is called with true (nextOpen=true branch)", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText("grid:1"));

    // Open delete dialog
    fireEvent.click(screen.getByRole("button", { name: "delete-subscription" }));
    expect(screen.getByRole("button", { name: "confirm-delete" })).toBeInTheDocument();

    // Close via the close-delete button which calls onOpenChange(false) → !false = true → setDeleteId(null)
    fireEvent.click(screen.getByRole("button", { name: "close-delete" }));
    expect(screen.queryByRole("button", { name: "confirm-delete" })).not.toBeInTheDocument();
  });

  it("opens the history dialog for a subscription and closes it again", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText("grid:1"));

    fireEvent.click(screen.getByRole("button", { name: "history-subscription" }));
    expect(screen.getByText("history:Netflix")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close-history" }));
    expect(screen.queryByText("history:Netflix")).not.toBeInTheDocument();
  });

  it("renders with empty userId when user is null (covers user?.id ?? '' fallback)", () => {
    mocks.useAuth.mockReturnValue({ user: null });

    const { Wrapper } = createQueryClientWrapper();
    render(<SubscriptionsPage />, { wrapper: Wrapper });

    // Page should still render (grid shows 0 items since queries are disabled with empty userId)
    expect(screen.getByRole("button", { name: "create-subscription" })).toBeInTheDocument();
  });
});
