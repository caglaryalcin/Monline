import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import { CategoriesTab } from "@/components/settings/categories/CategoriesTab";
import tr from "@/lib/locales/tr.json";

const mocks = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), subscriptions: vi.fn(), remove: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/services/categories", () => ({ categoriesService: { list: mocks.list, subscriptionCount: mocks.count, delete: mocks.remove } }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { list: mocks.subscriptions } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
const i18n = createInstance();
await i18n.use(initReactI18next).init({ lng: "tr", resources: { tr: { translation: tr } }, interpolation: { escapeValue: false } });
const category = { id: "category", user: "user", name: "Custom", translation_key: "" };
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><I18nextProvider i18n={i18n}><CategoriesTab /></I18nextProvider></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([category]);
  mocks.count.mockResolvedValue(5);
  mocks.subscriptions.mockResolvedValue([]);
  mocks.remove.mockResolvedValue(undefined);
});
it("counts active and inactive subscriptions only in their assigned category", async () => {
  mocks.subscriptions.mockResolvedValue([
    { id: "active", category: "category", inactive: false },
    { id: "inactive", category: "category", inactive: true },
    { id: "other", category: "other-category", inactive: false },
    { id: "unassigned", category: "", inactive: false },
  ]);
  mount();
  expect(await screen.findByText("2", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText("2", { selector: "strong" }).parentElement).toHaveTextContent("2 abonelik");
  expect(mocks.subscriptions).toHaveBeenCalledWith("user");
});
it("shows zero for an unused category after subscriptions load", async () => {
  mount();
  expect(await screen.findByText("0", { selector: "strong" })).toBeInTheDocument();
});
it("shows a bold usage count and retains the server's category-in-use protection", async () => {
  mocks.remove.mockRejectedValue(new Error("category_in_use"));
  mount();
  await userEvent.click(await screen.findByRole("button", { name: tr.delete }));
  const dialog = await screen.findByRole("alertdialog");
  expect(await within(dialog).findByText("5", { selector: "strong" })).toBeInTheDocument();
  expect(dialog).toHaveTextContent("Bu kategori 5 abonelikte kullanılıyor. Silmek istediğinizden emin misiniz?");
  expect(mocks.count).toHaveBeenCalledWith("user", "category");
  await userEvent.click(within(dialog).getByRole("button", { name: tr.delete }));
  await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledWith(tr.category_in_use));
  expect(screen.getByText("Custom")).toBeInTheDocument();
});
it("prevents deletion until the usage count arrives", async () => {
  let resolveCount!: (count: number) => void;
  mocks.count.mockReturnValue(new Promise<number>((resolve) => { resolveCount = resolve; }));
  mount();
  await userEvent.click(await screen.findByRole("button", { name: tr.delete }));
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByRole("button", { name: tr.delete })).toBeDisabled();
  expect(dialog).toHaveTextContent(tr.loading);
  resolveCount(1);
  expect(await within(dialog).findByText("1", { selector: "strong" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: tr.delete })).toBeEnabled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("keeps the ordinary confirmation for unused categories", async () => {
  mocks.count.mockResolvedValue(0);
  mount();
  await userEvent.click(await screen.findByRole("button", { name: tr.delete }));
  const dialog = await screen.findByRole("alertdialog");
  expect(await within(dialog).findByText(tr.confirm_delete)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: tr.delete }));
  await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("category"));
});
it("blocks deletion when usage cannot be loaded", async () => {
  mocks.count.mockRejectedValue(new Error("offline"));
  mount();
  await userEvent.click(await screen.findByRole("button", { name: tr.delete }));
  const dialog = await screen.findByRole("alertdialog");
  expect(await within(dialog).findByText(tr.category_usage_load_error)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: tr.delete })).toBeDisabled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
