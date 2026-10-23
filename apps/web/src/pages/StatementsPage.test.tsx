import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import type * as ReactI18next from "react-i18next";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { statementTranslations } from "@/lib/statementTranslations";
import { createQueryClientWrapper } from "@/test/query-client";

import { StatementsPage } from "./StatementsPage";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  remove: vi.fn(),
  items: [] as { id: string; bank: string; period: string; file_name: string }[],
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/api", () => ({ api: { post: mocks.post } }));
vi.mock("@/lib/client", () => ({
  default: {
    collection: () => ({
      getList: async () => ({ items: mocks.items, totalPages: 1 }),
      delete: mocks.remove,
    }),
  },
}));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { list: async () => [] } }));
vi.mock("@/lib/statementPdf", () => ({
  readStatementPdf: async () => ({
    lines: [],
    fileHash: "a".repeat(64),
    pageCount: 1,
    emptyPages: 0,
  }),
}));
vi.mock("@/lib/statements", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  detectStatement: () => ({ bank: "enpara", period: "2026-01" }),
  parseStatement: () => ({
    transactions: [
      {
        id: "row-1",
        date: "2026-01-22",
        merchant: "NETFLIX.COM",
        amount: 15,
        currency: "TRY",
        kind: "charge",
        page: 1,
        installment: "",
        source: "NETFLIX.COM",
        included: true,
        uncertain: false,
      },
    ],
    unresolved: [],
  }),
}));

const noteI18n = createInstance();
void noteI18n.init({
  lng: "en",
  initImmediate: false,
  resources: { en: { translation: statementTranslations.en } },
});

function openPage() {
  const { client, Wrapper } = createQueryClientWrapper();
  render(
    <I18nextProvider i18n={noteI18n}>
      <StatementsPage />
    </I18nextProvider>,
    { wrapper: Wrapper },
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.items = [];
});

describe("statement review and archive", () => {
  it("requires confirmation before deleting the entire archive and refreshes every archive page", async () => {
    mocks.items = [
      { id: "statement-1", bank: "enpara", period: "2026-01", file_name: "statement.pdf" },
    ];
    mocks.post.mockResolvedValue({ deleted: 13 });
    const client = openPage();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    await screen.findByText("statement.pdf");
    await userEvent.click(screen.getByRole("button", { name: "statement_delete_all" }));
    expect(mocks.post).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "cancel" }),
    );
    expect(mocks.post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "statement_delete_all" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "delete" }),
    );
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledExactlyOnceWith("/api/statements/delete-all", {
        confirmed: true,
      }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["bank-statements", "user-1"] });
  });

  it("retains the archive when bulk deletion fails", async () => {
    mocks.items = [
      { id: "statement-1", bank: "enpara", period: "2026-01", file_name: "statement.pdf" },
    ];
    mocks.post.mockRejectedValue(new Error("network"));
    openPage();
    await screen.findByText("statement.pdf");
    await userEvent.click(screen.getByRole("button", { name: "statement_delete_all" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "delete" }),
    );
    await screen.findByText("statement_delete_failed");
    expect(screen.getByText("statement.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "statement_delete_all" })).toBeEnabled();
  });
  it("opens category and payment method settings in separate tabs from the information note", () => {
    openPage();
    const categories = screen.getByRole("link", { name: "categories" });
    const methods = screen.getByRole("link", { name: "payment methods" });
    expect(categories).toHaveAttribute("href", "/settings?tab=categories");
    expect(methods).toHaveAttribute("href", "/settings?tab=payment_methods");
    for (const link of [categories, methods]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
  it("repeats the duplicate PDF warning beside the save button", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(new Error("statement_duplicate"));
    openPage();
    await screen.findByText("statement_archive_empty");
    await user.upload(
      screen.getByLabelText("statement_file"),
      new File(["%PDF-test"], "statement.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "statement_read" }));
    const save = await screen.findByRole("button", { name: "statement_save" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "statement_review_confirm" }));
    expect(save).toBeEnabled();
    await user.click(save);
    await screen.findByRole("alert");
    expect(screen.getAllByText("statement_duplicate")).toHaveLength(2);
    expect(within(save.parentElement!).getByText("statement_duplicate")).toBeInTheDocument();
  });

  it("confirms archive deletion with Enter after the trash button is clicked", async () => {
    const user = userEvent.setup();
    mocks.items = [
      { id: "statement-1", bank: "enpara", period: "2026-01", file_name: "statement.pdf" },
    ];
    mocks.remove.mockResolvedValue(true);
    openPage();
    await screen.findByText("statement.pdf");
    await user.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.getByRole("button", { name: "delete" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("statement-1"));
  });
});
